"""
Telegram Bot Service — sends notifications to users via Telegram.

Setup:
  1. Create a bot via @BotFather on Telegram → get BOT_TOKEN
  2. Set TELEGRAM_BOT_TOKEN in .env
  3. Users link their Telegram by sending /start to the bot
  4. The bot replies with their chat_id automatically

Usage:
  await send_telegram_message(chat_id, "Your event reminder!")
"""

import asyncio
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


# ==================== BOT COMMAND HANDLER ====================

_polling_task: asyncio.Task | None = None
_last_update_id: int = 0


async def _handle_bot_updates():
    """Poll Telegram for incoming messages and respond to commands."""
    global _last_update_id

    if not TELEGRAM_BOT_TOKEN:
        return

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
    logger.info("🤖 Telegram bot polling started")

    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            try:
                params = {"offset": _last_update_id + 1, "timeout": 10}
                response = await client.get(url, params=params)

                if response.status_code != 200:
                    await asyncio.sleep(5)
                    continue

                data = response.json()
                if not data.get("ok") or not data.get("result"):
                    await asyncio.sleep(1)
                    continue

                for update in data["result"]:
                    _last_update_id = update["update_id"]
                    message = update.get("message")
                    if not message or not message.get("text"):
                        continue

                    chat_id = message["chat"]["id"]
                    text = message["text"].strip()
                    first_name = message["from"].get("first_name", "there")

                    if text in ("/start", "/chatid"):
                        reply = (
                            f"🛡️ <b>EventIQ Secure Bot</b>\n\n"
                            f"Hi {first_name}! 👋\n\n"
                            f"Your Chat ID is:\n"
                            f"<code>{chat_id}</code>\n\n"
                            f"📋 <b>How to link:</b>\n"
                            f"1. Copy the Chat ID above\n"
                            f"2. Go to your <b>EventIQ Profile</b> page\n"
                            f"3. Paste it in the Telegram Chat ID field\n"
                            f"4. Click Save & Send Test Message\n\n"
                            f"✅ Once linked, you'll receive event confirmations, "
                            f"QR tickets, and reminders here!"
                        )
                        await send_telegram_message(chat_id, reply)

                    elif text == "/help":
                        reply = (
                            f"🛡️ <b>EventIQ Secure Bot — Commands</b>\n\n"
                            f"/start — Get your Chat ID\n"
                            f"/chatid — Get your Chat ID\n"
                            f"/help — Show this help message\n\n"
                            f"📱 Link your Chat ID in EventIQ to receive notifications."
                        )
                        await send_telegram_message(chat_id, reply)

            except asyncio.CancelledError:
                logger.info("🤖 Telegram bot polling stopped")
                return
            except Exception as e:
                logger.error(f"Bot polling error: {e}")
                await asyncio.sleep(5)


def start_bot_polling():
    """Start the bot polling background task."""
    global _polling_task
    if _polling_task and not _polling_task.done():
        return
    if not TELEGRAM_BOT_TOKEN:
        logger.warning("Telegram bot token not set — bot polling disabled")
        return
    _polling_task = asyncio.create_task(_handle_bot_updates())
    logger.info("🤖 Telegram bot polling task created")


async def stop_bot_polling():
    """Stop the bot polling background task."""
    global _polling_task
    if _polling_task and not _polling_task.done():
        _polling_task.cancel()
        try:
            await _polling_task
        except asyncio.CancelledError:
            pass
    _polling_task = None
