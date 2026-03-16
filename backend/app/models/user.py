from sqlalchemy import Column, Integer, String, DateTime, BigInteger, func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="student")  # student, organizer, dept_admin, college_admin
    department = Column(String(100), nullable=True)
    telegram_chat_id = Column(BigInteger, nullable=True)  # Telegram chat ID for notifications
    created_at = Column(DateTime, server_default=func.now())
