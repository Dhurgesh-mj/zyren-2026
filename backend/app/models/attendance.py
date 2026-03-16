from sqlalchemy import Column, Integer, DateTime, ForeignKey, func
from app.database import Base


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    checkin_time = Column(DateTime, server_default=func.now())
    scanner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
