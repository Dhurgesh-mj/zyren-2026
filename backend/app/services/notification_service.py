"""
Notification Service — handles all notification triggers.

Notification Triggers:
  1. Registration confirmed     → confirmation
  2. Added to waitlist          → info
  3. Promoted from waitlist     → alert
  4. Event reminder (24h)       → reminder
  5. Event reminder (1h)        → reminder
  6. Event update               → info
  7. Registration cancelled     → info
  8. Attendance recorded        → confirmation

Each notification is:
  - Saved to the database (persistent)
  - Pushed to Redis queue (for async delivery via email/SMS/Telegram)
"""

import logging
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification import Notification
from app.services.redis_service import enqueue_notification

logger = logging.getLogger("eventiq.notifications")


async def send_notification(
    db: AsyncSession,
    user_id: int,
    message: str,
    type: str = "info",
    event_id: int | None = None,
    delivery_channels: list[str] | None = None,
):
    """
    Create a notification and enqueue it for delivery.
    
    Args:
        db: Database session
        user_id: Target user ID
        message: Notification text
        type: info | confirmation | reminder | alert
        event_id: Related event ID (optional)
        delivery_channels: List of channels ['email', 'sms', 'telegram'] (optional)
    """
    # 1. Save to database (persistent storage)
    notif = Notification(
        user_id=user_id,
        event_id=event_id,
        message=message,
        type=type,
        status="unread",
    )
    db.add(notif)
    await db.flush()

    # 2. Push to Redis queue for async delivery
    queue_data = {
        "notification_id": notif.id,
        "user_id": user_id,
        "event_id": event_id,
        "message": message,
        "type": type,
        "channels": delivery_channels or ["in_app"],
    }
    await enqueue_notification(queue_data)

    logger.info(f"📬 Notification sent: [{type}] to user {user_id} — {message[:50]}...")
    return notif


# ==================== TRIGGER FUNCTIONS ====================

async def notify_registration_confirmed(db: AsyncSession, user_id: int, event_id: int, event_title: str, event_date: str):
    """Trigger: Student confirmed registration."""
    return await send_notification(
        db, user_id,
        message=f"✅ Registration confirmed for '{event_title}' on {event_date}. Your QR ticket is ready!",
        type="confirmation",
        event_id=event_id,
        delivery_channels=["in_app", "email"],
    )


async def notify_waitlisted(db: AsyncSession, user_id: int, event_id: int, event_title: str):
    """Trigger: Student added to waitlist."""
    return await send_notification(
        db, user_id,
        message=f"⏳ You've been added to the waitlist for '{event_title}'. We'll notify you if a spot opens up.",
        type="info",
        event_id=event_id,
        delivery_channels=["in_app", "email"],
    )


async def notify_waitlist_promoted(db: AsyncSession, user_id: int, event_id: int, event_title: str):
    """Trigger: Student promoted from waitlist."""
    return await send_notification(
        db, user_id,
        message=f"🎉 Great news! You've been promoted from the waitlist for '{event_title}'! Your spot is confirmed and QR ticket is ready.",
        type="alert",
        event_id=event_id,
        delivery_channels=["in_app", "email", "sms"],
    )


async def notify_event_reminder(db: AsyncSession, user_id: int, event_id: int, event_title: str, time_until: str):
    """Trigger: Event reminder (24h or 1h before)."""
    return await send_notification(
        db, user_id,
        message=f"⏰ Reminder: '{event_title}' starts in {time_until}. Don't forget your QR ticket!",
        type="reminder",
        event_id=event_id,
        delivery_channels=["in_app", "email"],
    )


async def notify_event_update(db: AsyncSession, user_id: int, event_id: int, event_title: str, update_detail: str):
    """Trigger: Event details updated."""
    return await send_notification(
        db, user_id,
        message=f"📝 Event update for '{event_title}': {update_detail}",
        type="info",
        event_id=event_id,
        delivery_channels=["in_app"],
    )


async def notify_registration_cancelled(db: AsyncSession, user_id: int, event_id: int, event_title: str):
    """Trigger: Registration cancelled."""
    return await send_notification(
        db, user_id,
        message=f"❌ Your registration for '{event_title}' has been cancelled.",
        type="info",
        event_id=event_id,
        delivery_channels=["in_app"],
    )


async def notify_attendance_recorded(db: AsyncSession, user_id: int, event_id: int, event_title: str):
    """Trigger: Attendance check-in recorded."""
    return await send_notification(
        db, user_id,
        message=f"✅ Attendance recorded for '{event_title}'. Welcome to the event!",
        type="confirmation",
        event_id=event_id,
        delivery_channels=["in_app"],
    )


async def notify_event_approved(db: AsyncSession, organizer_id: int, event_id: int, event_title: str):
    """Trigger: Event approved by admin."""
    return await send_notification(
        db, organizer_id,
        message=f"🎯 Your event '{event_title}' has been approved and published! Students can now register.",
        type="alert",
        event_id=event_id,
        delivery_channels=["in_app", "email"],
    )
