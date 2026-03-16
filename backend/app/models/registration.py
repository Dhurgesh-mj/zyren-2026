from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from app.database import Base


class Registration(Base):
    __tablename__ = "registrations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    status = Column(String(20), nullable=False, default="confirmed")  # confirmed, waitlisted, cancelled
    qr_token = Column(String(500), nullable=True)
    registered_at = Column(DateTime, server_default=func.now())
