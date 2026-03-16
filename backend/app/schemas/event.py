from pydantic import BaseModel
from typing import Optional
from datetime import date, time, datetime


class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    date: date
    time: time
    venue: str
    capacity: int
    category: str
    registration_deadline: date


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[date] = None
    time: Optional[time] = None
    venue: Optional[str] = None
    capacity: Optional[int] = None
    category: Optional[str] = None
    status: Optional[str] = None
    registration_deadline: Optional[date] = None


class EventResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    date: date
    time: time
    venue: str
    capacity: int
    category: str
    organizer_id: int
    status: str
    registration_deadline: date
    created_at: Optional[datetime] = None
    registered_count: Optional[int] = 0
    organizer_name: Optional[str] = None

    class Config:
        from_attributes = True
