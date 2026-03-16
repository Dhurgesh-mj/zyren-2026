from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.database import get_db
from app.models.user import User
from app.models.notification import Notification
from app.schemas.registration import NotificationResponse
from app.utils.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/", response_model=list[NotificationResponse])
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
        ).order_by(Notification.created_at.desc()).limit(50)
    )
    notifications = result.scalars().all()
    return [NotificationResponse.model_validate(n) for n in notifications]


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        ).values(status="read")
    )
    await db.commit()
    return {"message": "Notification marked as read"}


@router.post("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(Notification).where(
            Notification.user_id == current_user.id,
            Notification.status == "unread",
        ).values(status="read")
    )
    await db.commit()
    return {"message": "All notifications marked as read"}
