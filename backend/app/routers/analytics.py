from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.user import User
from app.models.event import Event
from app.models.registration import Registration
from app.models.attendance import Attendance
from app.models.audit_log import AuditLog
from app.utils.auth import require_roles
from app.services.redis_service import (
    cache_get, cache_set,
    get_queue_length, get_active_sessions_count,
    is_redis_available,
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/overview")
async def analytics_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("organizer", "dept_admin", "college_admin")),
):
    # Try Redis cache first (60s TTL for dashboard stats)
    cached = await cache_get("analytics:overview")
    if cached:
        # Still fetch fresh audit logs (not cached for security)
        recent_logs = await db.execute(
            select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(20)
        )
        cached["recent_audit_logs"] = [
            {
                "id": log.id,
                "user_id": log.user_id,
                "action": log.action,
                "details": log.details,
                "ip_address": log.ip_address,
                "timestamp": str(log.timestamp) if log.timestamp else None,
            }
            for log in recent_logs.scalars().all()
        ]
        cached["cache_hit"] = True
        return cached

    # Total events
    total_events = await db.execute(select(func.count(Event.id)))
    # Total users
    total_users = await db.execute(select(func.count(User.id)))
    # Total registrations
    total_registrations = await db.execute(
        select(func.count(Registration.id)).where(Registration.status == "confirmed")
    )
    # Total attendance
    total_attendance = await db.execute(select(func.count(Attendance.id)))
    # Events by status
    events_by_status = await db.execute(
        select(Event.status, func.count(Event.id)).group_by(Event.status)
    )
    # Events by category
    events_by_category = await db.execute(
        select(Event.category, func.count(Event.id)).group_by(Event.category)
    )
    # Recent audit logs
    recent_logs = await db.execute(
        select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(20)
    )

    # Redis queue stats
    queue_len = await get_queue_length()
    active_sessions = await get_active_sessions_count()

    overview = {
        "total_events": total_events.scalar() or 0,
        "total_users": total_users.scalar() or 0,
        "total_registrations": total_registrations.scalar() or 0,
        "total_attendance": total_attendance.scalar() or 0,
        "events_by_status": dict(events_by_status.all()),
        "events_by_category": dict(events_by_category.all()),
        "notification_queue_size": queue_len,
        "active_sessions": active_sessions,
        "redis_connected": is_redis_available(),
        "recent_audit_logs": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "action": log.action,
                "details": log.details,
                "ip_address": log.ip_address,
                "timestamp": str(log.timestamp) if log.timestamp else None,
            }
            for log in recent_logs.scalars().all()
        ],
        "cache_hit": False,
    }

    # Cache the stats (but not audit logs — they're always fresh)
    cache_data = {k: v for k, v in overview.items() if k != "recent_audit_logs"}
    await cache_set("analytics:overview", cache_data, ttl=60)

    return overview


@router.get("/events")
async def event_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("organizer", "dept_admin", "college_admin")),
):
    # Try cache first (30s TTL)
    cached = await cache_get("analytics:events")
    if cached:
        return cached

    # Get all events with registration and attendance counts
    events = await db.execute(
        select(Event).order_by(Event.date.desc())
    )

    result = []
    for event in events.scalars().all():
        reg_count = await db.execute(
            select(func.count(Registration.id)).where(
                Registration.event_id == event.id,
                Registration.status == "confirmed",
            )
        )
        att_count = await db.execute(
            select(func.count(Attendance.id)).where(
                Attendance.event_id == event.id,
            )
        )
        waitlist_count = await db.execute(
            select(func.count(Registration.id)).where(
                Registration.event_id == event.id,
                Registration.status == "waitlisted",
            )
        )

        registered = reg_count.scalar() or 0
        attended = att_count.scalar() or 0
        waitlisted = waitlist_count.scalar() or 0

        result.append({
            "id": event.id,
            "title": event.title,
            "date": str(event.date),
            "category": event.category,
            "capacity": event.capacity,
            "registered": registered,
            "attended": attended,
            "waitlisted": waitlisted,
            "attendance_rate": round((attended / registered * 100), 1) if registered > 0 else 0,
            "fill_rate": round((registered / event.capacity * 100), 1) if event.capacity > 0 else 0,
            "status": event.status,
        })

    # Cache for 30s
    await cache_set("analytics:events", result, ttl=30)
    return result


@router.get("/attendance")
async def attendance_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("organizer", "dept_admin", "college_admin")),
):
    # Attendance by category
    result = await db.execute(
        select(Event.category, func.count(Attendance.id))
        .join(Event, Attendance.event_id == Event.id)
        .group_by(Event.category)
    )
    by_category = dict(result.all())

    # Recent check-ins
    recent = await db.execute(
        select(Attendance, User.name, Event.title)
        .join(User, Attendance.user_id == User.id)
        .join(Event, Attendance.event_id == Event.id)
        .order_by(Attendance.checkin_time.desc())
        .limit(20)
    )

    recent_checkins = [
        {
            "user_name": name,
            "event_title": title,
            "checkin_time": str(att.checkin_time) if att.checkin_time else None,
        }
        for att, name, title in recent.all()
    ]

    return {
        "attendance_by_category": by_category,
        "recent_checkins": recent_checkins,
    }


@router.get("/redis-status")
async def redis_status(
    current_user: User = Depends(require_roles("college_admin")),
):
    """Redis connection and queue status — admin only."""
    return {
        "redis_connected": is_redis_available(),
        "notification_queue_size": await get_queue_length(),
        "active_sessions": await get_active_sessions_count(),
    }
