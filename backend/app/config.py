import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./eventiq.db")
SECRET_KEY = os.getenv("SECRET_KEY", "eventiq-super-secret-key-change-in-production-2026")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
QR_SECRET_KEY = os.getenv("QR_SECRET_KEY", "qr-signing-secret-key-change-in-production")

# Redis configuration (optional - falls back to in-memory if not available)
REDIS_URL = os.getenv("REDIS_URL", None)  # e.g., "redis://localhost:6379"

# Telegram Bot (optional — get token from @BotFather)
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", None)

# QR code image storage
QR_CODE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "qr_codes")
os.makedirs(QR_CODE_DIR, exist_ok=True)
