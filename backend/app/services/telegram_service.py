"""
Telegram Bot Service — sends notifications to users via Telegram.

Setup:
  1. Create a bot via @BotFather on Telegram → get BOT_TOKEN
  2. Set TELEGRAM_BOT_TOKEN in .env
  3. Users link their Telegram by sending /start to the bot
  4. The bot stores the chat_id → user mapping

Usage:
  await send_telegram_message(chat_id, "Your event reminder!")
"""

import logging
import httpx
from app.config import TELEGRAM_BOT_TOKEN

logger = logging.getLogger("eventiq.telegram")

# In-memory store for user_id → telegram_chat_id mapping
# In production, store this in the User model or a separate table
_telegram_chat_ids: dict[int, int] = {}


def is_telegram_configured() -> bool:
    return bool(TELEGRAM_BOT_TOKEN)


async def send_telegram_message(chat_id: int, message: str, parse_mode: str = "HTML") -> bool:
    """
    Send a message to a Telegram user via Bot API.
    
    Args:
        chat_id: Telegram chat ID of the recipient
        message: Message text (supports HTML formatting)
        parse_mode: HTML or Markdown
    
    Returns:
        True if sent successfully
    """
    if not TELEGRAM_BOT_TOKEN:
        logger.warning("Telegram bot token not configured. Set TELEGRAM_BOT_TOKEN in .env")
        return False

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": parse_mode,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(url, json=payload)
            if response.status_code == 200:
                logger.info(f"✈️ Telegram message sent to chat {chat_id}")
                return True
            else:
                logger.error(f"Telegram API error: {response.status_code} — {response.text}")
                return False
    except Exception as e:
        logger.error(f"Telegram send failed: {e}")
        return False


async def send_telegram_photo(chat_id: int, photo_path: str, caption: str = "") -> bool:
    """Send a photo (QR code image) to a Telegram user."""
    if not TELEGRAM_BOT_TOKEN:
        return False

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            with open(photo_path, "rb") as photo:
                response = await client.post(
                    url,
                    data={"chat_id": chat_id, "caption": caption, "parse_mode": "HTML"},
                    files={"photo": ("qr_ticket.png", photo, "image/png")},
                )
            if response.status_code == 200:
                logger.info(f"✈️ Telegram photo sent to chat {chat_id}")
                return True
            else:
                logger.error(f"Telegram photo error: {response.status_code}")
                return False
    except Exception as e:
        logger.error(f"Telegram photo send failed: {e}")
        return False


# ==================== USER LINKING ====================

def link_telegram(user_id: int, chat_id: int):
    """Link a user account to their Telegram chat ID."""
    _telegram_chat_ids[user_id] = chat_id
    logger.info(f"🔗 Linked user {user_id} → Telegram chat {chat_id}")


def get_telegram_chat_id(user_id: int) -> int | None:
    """Get the Telegram chat ID for a user."""
    return _telegram_chat_ids.get(user_id)


def unlink_telegram(user_id: int):
    """Unlink a user's Telegram account."""
    _telegram_chat_ids.pop(user_id, None)


# ==================== FORMATTED MESSAGES ====================

def format_registration_message(event_title: str, event_date: str, event_venue: str, event_time: str) -> str:
    return (
        f"🎟️ <b>Registration Confirmed!</b>\n\n"
        f"📌 <b>{event_title}</b>\n"
        f"📅 Date: {event_date}\n"
        f"⏰ Time: {event_time}\n"
        f"📍 Venue: {event_venue}\n\n"
        f"✅ Your QR ticket has been generated.\n"
        f"Show it at the venue for check-in!"
    )


def format_reminder_message(event_title: str, time_until: str) -> str:
    return (
        f"⏰ <b>Event Reminder</b>\n\n"
        f"📌 <b>{event_title}</b> starts in <b>{time_until}</b>!\n\n"
        f"🎟️ Don't forget your QR ticket!"
    )


def format_waitlist_promoted_message(event_title: str) -> str:
    return (
        f"🎉 <b>Great News!</b>\n\n"
        f"You've been promoted from the waitlist for <b>{event_title}</b>!\n\n"
        f"✅ Your spot is confirmed and QR ticket is ready."
    )


def format_attendance_message(event_title: str) -> str:
    return (
        f"✅ <b>Attendance Recorded</b>\n\n"
        f"📌 Check-in confirmed for <b>{event_title}</b>.\n"
        f"Welcome to the event! 🎯"
    )
