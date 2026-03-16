"""
Notification Worker — processes the Redis notification queue.

Run as a separate process:
  python -m app.services.notification_worker

This worker:
  1. Pops notification jobs from the Redis queue
  2. Dispatches them to the appropriate channel (email, SMS, Telegram)
  3. Logs delivery status

In production, this would integrate with:
  - SMTP server for email
  - Twilio for SMS
  - Telegram Bot API for Telegram
"""

import asyncio
import json
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("eventiq.worker")


async def deliver_email(user_id: int, message: str, notification_id: int):
    """
    Simulate email delivery.
    In production: Use SMTP (smtplib) or a service like SendGrid/AWS SES.
    """
    logger.info(f"📧 [EMAIL] → User {user_id}: {message[:60]}...")
    # Simulate network delay
    await asyncio.sleep(0.1)
    logger.info(f"📧 [EMAIL] ✅ Delivered notification #{notification_id}")
    return True


async def deliver_sms(user_id: int, message: str, notification_id: int):
    """
    Simulate SMS delivery.
    In production: Use Twilio API.
    """
    logger.info(f"📱 [SMS] → User {user_id}: {message[:40]}...")
    await asyncio.sleep(0.1)
    logger.info(f"📱 [SMS] ✅ Delivered notification #{notification_id}")
    return True


async def deliver_telegram(user_id: int, message: str, notification_id: int):
    """
    Simulate Telegram delivery.
    In production: Use python-telegram-bot or direct Bot API.
    """
    logger.info(f"✈️ [TELEGRAM] → User {user_id}: {message[:40]}...")
    await asyncio.sleep(0.1)
    logger.info(f"✈️ [TELEGRAM] ✅ Delivered notification #{notification_id}")
    return True


CHANNEL_HANDLERS = {
    "email": deliver_email,
    "sms": deliver_sms,
    "telegram": deliver_telegram,
}


async def process_notification(job: dict):
    """Process a single notification job from the queue."""
    notification_id = job.get("notification_id", 0)
    user_id = job.get("user_id", 0)
    message = job.get("message", "")
    channels = job.get("channels", ["in_app"])

    logger.info(f"🔄 Processing notification #{notification_id} for user {user_id}")

    for channel in channels:
        if channel == "in_app":
            # Already saved to DB by the notification service
            continue

        handler = CHANNEL_HANDLERS.get(channel)
        if handler:
            try:
                await handler(user_id, message, notification_id)
            except Exception as e:
                logger.error(f"❌ Failed to deliver via {channel}: {e}")
        else:
            logger.warning(f"⚠️ Unknown delivery channel: {channel}")

    logger.info(f"✅ Notification #{notification_id} processed ({len(channels)} channels)")


async def run_worker():
    """Main worker loop — polls Redis queue for notification jobs."""
    from app.services.redis_service import get_redis, NOTIFICATION_QUEUE

    logger.info("🚀 Notification Worker starting...")
    logger.info("   Waiting for notifications in Redis queue...")

    r = await get_redis()
    if r is None:
        logger.error("❌ Redis not available. Worker cannot start.")
        logger.error("   Set REDIS_URL in .env and ensure Redis is running.")
        return

    processed = 0
    while True:
        try:
            # Blocking pop with 5s timeout
            result = await r.blpop(NOTIFICATION_QUEUE, timeout=5)
            if result:
                _, data = result
                job = json.loads(data)
                await process_notification(job)
                processed += 1

                if processed % 10 == 0:
                    logger.info(f"📊 Worker stats: {processed} notifications processed")
        except asyncio.CancelledError:
            logger.info("Worker shutting down...")
            break
        except Exception as e:
            logger.error(f"Worker error: {e}")
            await asyncio.sleep(1)


if __name__ == "__main__":
    try:
        asyncio.run(run_worker())
    except KeyboardInterrupt:
        logger.info("Worker stopped.")
