from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from app.database import get_db
from app.models.user import User
from app.models.event import Event
from app.models.registration import Registration
from app.schemas.event import EventCreate, EventUpdate, EventResponse
from app.utils.auth import get_current_user, require_roles
from app.utils.audit import create_audit_log
from app.services.notification_service import notify_event_approved, notify_event_update
from app.services.redis_service import cache_get, cache_set, cache_delete

router = APIRouter(prefix="/events", tags=["Events"])


@router.post("/create", response_model=EventResponse)
async def create_event(
    event_data: EventCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("organizer", "dept_admin", "college_admin")),
):
    new_event = Event(
        title=event_data.title,
        description=event_data.description,
        date=event_data.date,
        time=event_data.time,
        venue=event_data.venue,
        capacity=event_data.capacity,
        category=event_data.category,
        organizer_id=current_user.id,
        status="pending",
        registration_deadline=event_data.registration_deadline,
    )
    db.add(new_event)
    await db.commit()
    await db.refresh(new_event)

    await create_audit_log(
        db, current_user.id, "EVENT_CREATED",
        details=f"Event created: {new_event.title} (ID: {new_event.id})",
        ip_address=request.client.host if request.client else None
    )

    # Invalidate cached event listings
    await cache_delete("events:list")

    return EventResponse(
        **{c.name: getattr(new_event, c.name) for c in new_event.__table__.columns},
        registered_count=0,
        organizer_name=current_user.name
    )


@router.get("/list", response_model=list[EventResponse])
async def list_events(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(Event, User.name).join(User, Event.organizer_id == User.id)

    if status:
        query = query.where(Event.status == status)
    if category:
        query = query.where(Event.category == category)

    query = query.order_by(Event.date.desc())
    result = await db.execute(query)
    rows = result.all()

    events = []
    for event, organizer_name in rows:
        # Count registrations
        reg_count_result = await db.execute(
            select(func.count(Registration.id)).where(
                Registration.event_id == event.id,
                Registration.status == "confirmed"
            )
        )
        reg_count = reg_count_result.scalar() or 0

        events.append(EventResponse(
            **{c.name: getattr(event, c.name) for c in event.__table__.columns},
            registered_count=reg_count,
            organizer_name=organizer_name
        ))

    return events


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(event_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Event, User.name).join(User, Event.organizer_id == User.id).where(Event.id == event_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Event not found")

    event, organizer_name = row

    reg_count_result = await db.execute(
        select(func.count(Registration.id)).where(
            Registration.event_id == event.id,
            Registration.status == "confirmed"
        )
    )
    reg_count = reg_count_result.scalar() or 0

    return EventResponse(
        **{c.name: getattr(event, c.name) for c in event.__table__.columns},
        registered_count=reg_count,
        organizer_name=organizer_name
    )


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    event_data: EventUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("organizer", "dept_admin", "college_admin")),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Only organizer or admin can update
    if event.organizer_id != current_user.id and current_user.role not in ("dept_admin", "college_admin"):
        raise HTTPException(status_code=403, detail="Not authorized to update this event")

    update_data = event_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)

    await db.commit()
    await db.refresh(event)

    await create_audit_log(
        db, current_user.id, "EVENT_UPDATED",
        details=f"Event updated: {event.title} (ID: {event.id})",
        ip_address=request.client.host if request.client else None
    )

    return EventResponse(
        **{c.name: getattr(event, c.name) for c in event.__table__.columns},
        registered_count=0,
        organizer_name=current_user.name
    )


@router.post("/{event_id}/approve", response_model=EventResponse)
async def approve_event(
    event_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("dept_admin", "college_admin")),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending events can be approved")

    event.status = "published"
    await db.commit()
    await db.refresh(event)

    await create_audit_log(
        db, current_user.id, "EVENT_APPROVED",
        details=f"Event approved: {event.title} (ID: {event.id})",
        ip_address=request.client.host if request.client else None
    )

    # Notify organizer → saved to DB + pushed to Redis queue
    await notify_event_approved(db, event.organizer_id, event.id, event.title)
    await db.commit()

    # Invalidate cached event listings
    await cache_delete("events:list")

    return EventResponse(
        **{c.name: getattr(event, c.name) for c in event.__table__.columns},
        registered_count=0,
        organizer_name=current_user.name
    )


@router.post("/{event_id}/reject", response_model=EventResponse)
async def reject_event(
    event_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("dept_admin", "college_admin")),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending events can be rejected")

    event.status = "rejected"
    await db.commit()
    await db.refresh(event)

    await create_audit_log(
        db, current_user.id, "EVENT_REJECTED",
        details=f"Event rejected: {event.title} (ID: {event.id})",
        ip_address=request.client.host if request.client else None
    )

    # Notify organizer about rejection
    from app.services.notification_service import send_notification
    await send_notification(
        db,
        user_id=event.organizer_id,
        notification_type="event_rejected",
        message=f"Your event '{event.title}' has been rejected by the admin.",
    )
    await db.commit()

    # Invalidate cached event listings
    await cache_delete("events:list")

    return EventResponse(
        **{c.name: getattr(event, c.name) for c in event.__table__.columns},
        registered_count=0,
        organizer_name=current_user.name
    )
