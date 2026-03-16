from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "student"
    department: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    department: Optional[str] = None
    telegram_chat_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    telegram_chat_id: Optional[int] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
