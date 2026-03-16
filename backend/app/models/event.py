from sqlalchemy import Column, Integer, String, DateTime, Date, Time, ForeignKey, func
from app.database import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    description = Column(String(2000), nullable=True)
    date = Column(Date, nullable=False)
    time = Column(Time, nullable=False)
    venue = Column(String(200), nullable=False)
    capacity = Column(Integer, nullable=False)
    category = Column(String(50), nullable=False)  # Technical, Cultural, Sports, Workshop, Seminar
    organizer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), nullable=False, default="draft")  # draft, pending, published, completed, cancelled
    registration_deadline = Column(Date, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
