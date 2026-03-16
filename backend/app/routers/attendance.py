from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.models.event import Event
from app.models.registration import Registration
from app.models.attendance import Attendance
from app.schemas.registration import AttendanceCheckin, AttendanceResponse
from app.utils.auth import get_current_user, require_roles
from app.utils.qr import verify_qr_token
from app.utils.audit import create_audit_log
from app.services.notification_service import notify_attendance_recorded

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.post("/checkin", response_model=AttendanceResponse)
async def checkin(
    data: AttendanceCheckin,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("organizer", "dept_admin", "college_admin")),
):
    # Verify QR token
    payload = verify_qr_token(data.qr_token)
    if not payload:
        await create_audit_log(
            db, current_user.id, "CHECKIN_FAILED_INVALID_QR",
            details="Invalid or expired QR token presented",
            ip_address=request.client.host if request.client else None
        )
        raise HTTPException(status_code=400, detail="Invalid or expired QR code")

    event_id = payload["event_id"]
    user_id = payload["user_id"]

    # Verify event exists
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Verify registration
    reg_result = await db.execute(
        select(Registration).where(
            Registration.user_id == user_id,
            Registration.event_id == event_id,
            Registration.status == "confirmed",
            Registration.qr_token == data.qr_token,
        )
    )
    registration = reg_result.scalar_one_or_none()
    if not registration:
        raise HTTPException(status_code=400, detail="No valid registration found for this QR code")

    # Check duplicate check-in (replay attack prevention)
    existing_attendance = await db.execute(
        select(Attendance).where(
            Attendance.user_id == user_id,
            Attendance.event_id == event_id,
        )
    )
    if existing_attendance.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Attendance already recorded. Possible replay attack detected.")

    # Record attendance
    attendance = Attendance(
        user_id=user_id,
        event_id=event_id,
        scanner_id=current_user.id,
    )
    db.add(attendance)
    await db.commit()
    await db.refresh(attendance)

    # Get user name
    user_result = await db.execute(select(User).where(User.id == user_id))
    student = user_result.scalar_one_or_none()

    await create_audit_log(
        db, current_user.id, "ATTENDANCE_RECORDED",
        details=f"Check-in: User {user_id} at event {event.title} (ID: {event_id})",
        ip_address=request.client.host if request.client else None
    )

    # Notify student → saved to DB + pushed to Redis queue
    await notify_attendance_recorded(db, user_id, event_id, event.title)
    await db.commit()

    return AttendanceResponse(
        **{c.name: getattr(attendance, c.name) for c in attendance.__table__.columns},
        user_name=student.name if student else None,
        event_title=event.title,
    )


@router.get("/event/{event_id}", response_model=list[AttendanceResponse])
async def get_event_attendance(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("organizer", "dept_admin", "college_admin")),
):
    # Verify event exists
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    result = await db.execute(
        select(Attendance, User.name).join(User, Attendance.user_id == User.id).where(
            Attendance.event_id == event_id,
        ).order_by(Attendance.checkin_time.asc())
    )
    rows = result.all()

    return [
        AttendanceResponse(
            **{c.name: getattr(att, c.name) for c in att.__table__.columns},
            user_name=name,
            event_title=event.title,
        )
        for att, name in rows
    ]
