from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    message = Column(String(500), nullable=False)
    type = Column(String(30), nullable=False, default="info")  # info, reminder, alert, confirmation
    status = Column(String(20), nullable=False, default="unread")  # unread, read
    created_at = Column(DateTime, server_default=func.now())
