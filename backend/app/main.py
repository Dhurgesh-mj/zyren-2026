from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.config import REDIS_URL
from app.database import init_db
from app.routers import auth, events, registrations, attendance, notifications, analytics

# Rate limiter — uses Redis if available, otherwise in-memory
if REDIS_URL:
    limiter = Limiter(key_func=get_remote_address, storage_uri=REDIS_URL)
else:
    limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle: DB init + Redis connection."""
    # Startup
    await init_db()

    # Initialize Redis connection
    from app.services.redis_service import get_redis
    redis = await get_redis()
    if redis:
        print("🔴 Redis connected and ready")
    else:
        print("⚡ Running without Redis (set REDIS_URL to enable)")

    # Start Telegram bot polling
    from app.services.telegram_service import start_bot_polling, is_telegram_configured
    if is_telegram_configured():
        start_bot_polling()
        print("🤖 Telegram bot polling started")
    else:
        print("📱 Telegram bot not configured (set TELEGRAM_BOT_TOKEN to enable)")

    yield

    # Shutdown
    from app.services.telegram_service import stop_bot_polling
    await stop_bot_polling()
    from app.services.redis_service import close_redis
    await close_redis()


app = FastAPI(
    title="EventIQ Secure",
    description="Cybersecurity-Driven College Event Management System",
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limiter state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(events.router)
app.include_router(registrations.router)
app.include_router(attendance.router)
app.include_router(notifications.router)
app.include_router(analytics.router)


@app.get("/")
async def root():
    from app.services.redis_service import is_redis_available
    return {
        "name": "EventIQ Secure",
        "tagline": "Secure Events • Verified Attendance • Smarter Campuses",
        "version": "1.0.0",
        "docs": "/docs",
        "security": {
            "authentication": "JWT (HS256)",
            "password_hashing": "bcrypt",
            "qr_signing": "HMAC-SHA256",
            "rate_limiting": "Redis-backed" if REDIS_URL else "In-memory (slowapi)",
            "rbac": "4-tier Role-Based Access Control",
            "audit_logging": "Full action logging with IP tracking",
            "redis": "Connected" if is_redis_available() else "Not configured",
        }
    }


@app.get("/health")
async def health():
    from app.services.redis_service import is_redis_available, get_queue_length
    queue = await get_queue_length()
    return {
        "status": "healthy",
        "database": "connected",
        "redis": "connected" if is_redis_available() else "not configured",
        "notification_queue": queue,
    }
