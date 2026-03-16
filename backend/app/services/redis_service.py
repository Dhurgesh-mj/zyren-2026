"""
Redis Service — handles connection, caching, and queue operations.

Used for:
  1. Rate limiting storage (via slowapi)
  2. Notification queue (push/pop jobs)
  3. Event data caching (TTL-based)
  4. Session tracking

Falls back gracefully if Redis is unavailable.
"""

import json
import logging
from typing import Optional
from app.config import REDIS_URL

logger = logging.getLogger("eventiq.redis")

# Redis client (lazy initialized)
_redis_client = None
_redis_available = False


async def get_redis():
    """Get or create the async Redis connection."""
    global _redis_client, _redis_available

    if _redis_client is not None:
        return _redis_client

    if not REDIS_URL:
        logger.info("Redis URL not configured — running without Redis")
        _redis_available = False
        return None

    try:
        import redis.asyncio as aioredis
        _redis_client = aioredis.from_url(
            REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=5,
        )
        # Test connection
        await _redis_client.ping()
        _redis_available = True
        logger.info(f"✅ Redis connected: {REDIS_URL}")
        return _redis_client
    except Exception as e:
        logger.warning(f"⚠️ Redis connection failed: {e}. Running without Redis.")
        _redis_client = None
        _redis_available = False
        return None


def is_redis_available() -> bool:
    return _redis_available


# ==================== CACHING ====================

async def cache_set(key: str, value: dict, ttl: int = 300):
    """Cache a value with TTL (default 5 minutes)."""
    r = await get_redis()
    if r is None:
        return
    try:
        await r.setex(f"cache:{key}", ttl, json.dumps(value, default=str))
    except Exception as e:
        logger.error(f"Cache set error: {e}")


async def cache_get(key: str) -> Optional[dict]:
    """Get a cached value. Returns None if not found or Redis unavailable."""
    r = await get_redis()
    if r is None:
        return None
    try:
        data = await r.get(f"cache:{key}")
        if data:
            return json.loads(data)
        return None
    except Exception as e:
        logger.error(f"Cache get error: {e}")
        return None


async def cache_delete(key: str):
    """Delete a cache key."""
    r = await get_redis()
    if r is None:
        return
    try:
        await r.delete(f"cache:{key}")
    except Exception as e:
        logger.error(f"Cache delete error: {e}")


# ==================== NOTIFICATION QUEUE ====================

NOTIFICATION_QUEUE = "eventiq:notification_queue"


async def enqueue_notification(notification_data: dict):
    """Push a notification job to the Redis queue."""
    r = await get_redis()
    if r is None:
        # Fallback: just log it (notification is still saved in DB)
        logger.info(f"[NO REDIS] Notification queued in-memory: {notification_data.get('message', '')}")
        return False
    try:
        await r.rpush(NOTIFICATION_QUEUE, json.dumps(notification_data, default=str))
        logger.info(f"📨 Notification queued: {notification_data.get('type', 'info')} for user {notification_data.get('user_id')}")
        return True
    except Exception as e:
        logger.error(f"Queue push error: {e}")
        return False


async def dequeue_notification() -> Optional[dict]:
    """Pop a notification job from the Redis queue."""
    r = await get_redis()
    if r is None:
        return None
    try:
        data = await r.lpop(NOTIFICATION_QUEUE)
        if data:
            return json.loads(data)
        return None
    except Exception as e:
        logger.error(f"Queue pop error: {e}")
        return None


async def get_queue_length() -> int:
    """Get the number of pending notifications in the queue."""
    r = await get_redis()
    if r is None:
        return 0
    try:
        return await r.llen(NOTIFICATION_QUEUE)
    except Exception:
        return 0


# ==================== SESSION TRACKING ====================

async def track_active_session(user_id: int, token_prefix: str):
    """Track an active user session in Redis."""
    r = await get_redis()
    if r is None:
        return
    try:
        await r.setex(f"session:{user_id}", 3600, token_prefix)
    except Exception as e:
        logger.error(f"Session tracking error: {e}")


async def get_active_sessions_count() -> int:
    """Count active user sessions."""
    r = await get_redis()
    if r is None:
        return 0
    try:
        keys = await r.keys("session:*")
        return len(keys)
    except Exception:
        return 0


# ==================== CLEANUP ====================

async def close_redis():
    """Close the Redis connection."""
    global _redis_client, _redis_available
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
        _redis_available = False
        logger.info("Redis connection closed")
