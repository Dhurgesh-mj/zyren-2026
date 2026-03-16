from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class RegistrationCreate(BaseModel):
    event_id: int


class RegistrationResponse(BaseModel):
    id: int
    user_id: int
    event_id: int
    status: str
    qr_token: Optional[str] = None
    registered_at: Optional[datetime] = None
    event_title: Optional[str] = None
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


class AttendanceCheckin(BaseModel):
    qr_token: str


class AttendanceResponse(BaseModel):
    id: int
    user_id: int
    event_id: int
    checkin_time: Optional[datetime] = None
    scanner_id: Optional[int] = None
    user_name: Optional[str] = None
    event_title: Optional[str] = None

    class Config:
        from_attributes = True


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    event_id: Optional[int] = None
    message: str
    type: str
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
