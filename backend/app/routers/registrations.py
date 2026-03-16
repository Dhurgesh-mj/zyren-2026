from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import date
from app.database import get_db
from app.models.user import User
from app.models.event import Event
from app.models.registration import Registration
from app.schemas.registration import RegistrationCreate, RegistrationResponse
from app.utils.auth import get_current_user
from app.utils.qr import generate_qr_token, generate_qr_ticket, generate_qr_image_base64
from app.utils.audit import create_audit_log
from app.services.notification_service import (
    notify_registration_confirmed,
    notify_waitlisted,
    notify_waitlist_promoted,
    notify_registration_cancelled,
)
from app.services.telegram_service import (
    get_telegram_chat_id, send_telegram_message, send_telegram_photo,
    format_registration_message, is_telegram_configured,
)

router = APIRouter(prefix="/registrations", tags=["Registrations"])


@router.post("/register", response_model=RegistrationResponse)
async def register_for_event(
    reg_data: RegistrationCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Get event
    result = await db.execute(select(Event).where(Event.id == reg_data.event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check event is published
    if event.status != "published":
        raise HTTPException(status_code=400, detail="Event is not open for registration")

    # Check registration deadline
    if date.today() > event.registration_deadline:
        raise HTTPException(status_code=400, detail="Registration deadline has passed")

    # Check duplicate registration
    existing = await db.execute(
        select(Registration).where(
            Registration.user_id == current_user.id,
            Registration.event_id == reg_data.event_id,
            Registration.status != "cancelled",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already registered for this event")

    # Check capacity
    confirmed_count = await db.execute(
        select(func.count(Registration.id)).where(
            Registration.event_id == reg_data.event_id,
            Registration.status == "confirmed",
        )
    )
    count = confirmed_count.scalar() or 0

    if count >= event.capacity:
        # Add to waitlist
        registration = Registration(
            user_id=current_user.id,
            event_id=reg_data.event_id,
            status="waitlisted",
        )
        db.add(registration)
        await db.commit()
        await db.refresh(registration)

        # Notification → saved to DB + pushed to Redis queue
        await notify_waitlisted(db, current_user.id, reg_data.event_id, event.title)
        await db.commit()

        return RegistrationResponse(
            **{c.name: getattr(registration, c.name) for c in registration.__table__.columns},
            event_title=event.title,
            user_name=current_user.name,
        )

    # Generate QR token
    qr_token = generate_qr_token(reg_data.event_id, current_user.id)

    registration = Registration(
        user_id=current_user.id,
        event_id=reg_data.event_id,
        status="confirmed",
        qr_token=qr_token,
    )
    db.add(registration)
    await db.commit()
    await db.refresh(registration)

    # Generate branded QR ticket image
    try:
        ticket_path, ticket_base64 = generate_qr_ticket(
            token=qr_token,
            event_title=event.title,
            user_name=current_user.name,
            event_date=str(event.date),
            event_venue=event.venue,
            event_id=event.id,
            user_id=current_user.id,
        )
    except Exception:
        ticket_path = None

    # Confirmation notification → saved to DB + pushed to Redis queue
    await notify_registration_confirmed(
        db, current_user.id, reg_data.event_id, event.title, str(event.date)
    )
    await db.commit()

    # Send Telegram notification + QR ticket photo
    if is_telegram_configured() and current_user.telegram_chat_id:
        chat_id = current_user.telegram_chat_id
        msg = format_registration_message(
            event.title, str(event.date), event.venue, str(event.time)
        )
        await send_telegram_message(chat_id, msg)
        if ticket_path:
            await send_telegram_photo(
                chat_id, ticket_path,
                caption=f"🎟️ Your QR ticket for {event.title}"
            )

    await create_audit_log(
        db, current_user.id, "REGISTRATION",
        details=f"Registered for event: {event.title} (ID: {event.id})",
        ip_address=request.client.host if request.client else None
    )

    return RegistrationResponse(
        **{c.name: getattr(registration, c.name) for c in registration.__table__.columns},
        event_title=event.title,
        user_name=current_user.name,
    )


@router.post("/cancel/{registration_id}", response_model=RegistrationResponse)
async def cancel_registration(
    registration_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Registration).where(
            Registration.id == registration_id,
            Registration.user_id == current_user.id,
        )
    )
    registration = result.scalar_one_or_none()
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")

    if registration.status == "cancelled":
        raise HTTPException(status_code=400, detail="Registration already cancelled")

    was_confirmed = registration.status == "confirmed"
    registration.status = "cancelled"
    registration.qr_token = None
    await db.commit()

    # Auto-promote from waitlist if someone cancelled a confirmed spot
    if was_confirmed:
        waitlisted = await db.execute(
            select(Registration).where(
                Registration.event_id == registration.event_id,
                Registration.status == "waitlisted",
            ).order_by(Registration.registered_at.asc()).limit(1)
        )
        next_in_line = waitlisted.scalar_one_or_none()
        if next_in_line:
            next_in_line.status = "confirmed"
            next_in_line.qr_token = generate_qr_token(next_in_line.event_id, next_in_line.user_id)
            await db.commit()

            # Get event title for notification
            event_result = await db.execute(select(Event).where(Event.id == next_in_line.event_id))
            event = event_result.scalar_one_or_none()

            # Notify promoted user → saved to DB + pushed to Redis queue
            await notify_waitlist_promoted(
                db, next_in_line.user_id, next_in_line.event_id, event.title
            )
            await db.commit()

    await create_audit_log(
        db, current_user.id, "REGISTRATION_CANCELLED",
        details=f"Cancelled registration ID: {registration_id}",
        ip_address=request.client.host if request.client else None
    )

    return RegistrationResponse(
        **{c.name: getattr(registration, c.name) for c in registration.__table__.columns},
        user_name=current_user.name,
    )


@router.get("/my", response_model=list[RegistrationResponse])
async def my_registrations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Registration, Event.title).join(Event, Registration.event_id == Event.id).where(
            Registration.user_id == current_user.id,
            Registration.status != "cancelled",
        ).order_by(Registration.registered_at.desc())
    )
    rows = result.all()

    return [
        RegistrationResponse(
            **{c.name: getattr(reg, c.name) for c in reg.__table__.columns},
            event_title=title,
            user_name=current_user.name,
        )
        for reg, title in rows
    ]


@router.get("/event/{event_id}", response_model=list[RegistrationResponse])
async def event_registrations(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check authorization (organizer of event or admin)
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.organizer_id != current_user.id and current_user.role not in ("dept_admin", "college_admin"):
        raise HTTPException(status_code=403, detail="Not authorized to view these registrations")

    result = await db.execute(
        select(Registration, User.name).join(User, Registration.user_id == User.id).where(
            Registration.event_id == event_id,
        ).order_by(Registration.registered_at.asc())
    )
    rows = result.all()

    return [
        RegistrationResponse(
            **{c.name: getattr(reg, c.name) for c in reg.__table__.columns},
            event_title=event.title,
            user_name=name,
        )
        for reg, name in rows
    ]


@router.get("/qr-ticket/{registration_id}")
async def get_qr_ticket(
    registration_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the branded QR ticket image for a registration as base64."""
    result = await db.execute(
        select(Registration).where(
            Registration.id == registration_id,
            Registration.user_id == current_user.id,
            Registration.status == "confirmed",
        )
    )
    registration = result.scalar_one_or_none()
    if not registration or not registration.qr_token:
        raise HTTPException(status_code=404, detail="Registration or QR ticket not found")

    # Get event details
    event_result = await db.execute(select(Event).where(Event.id == registration.event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Generate branded ticket
    try:
        ticket_path, ticket_base64 = generate_qr_ticket(
            token=registration.qr_token,
            event_title=event.title,
            user_name=current_user.name,
            event_date=str(event.date),
            event_venue=event.venue,
            event_id=event.id,
            user_id=current_user.id,
        )
    except Exception as e:
        # Fallback to plain QR
        ticket_base64 = generate_qr_image_base64(registration.qr_token)
        ticket_path = None

    return {
        "registration_id": registration.id,
        "event_title": event.title,
        "qr_token": registration.qr_token,
        "qr_image_base64": ticket_base64,
        "ticket_path": ticket_path,
    }


@router.post("/telegram/link")
async def link_telegram_account(
    data: dict,
    current_user: User = Depends(get_current_user),
):
    """Link user's Telegram chat ID for receiving notifications."""
    from app.services.telegram_service import link_telegram
    chat_id = data.get("chat_id")
    if not chat_id:
        raise HTTPException(status_code=400, detail="chat_id is required")

    link_telegram(current_user.id, int(chat_id))
    return {
        "status": "linked",
        "user_id": current_user.id,
        "telegram_chat_id": int(chat_id),
        "message": "Telegram account linked! You'll now receive notifications via Telegram.",
    }
