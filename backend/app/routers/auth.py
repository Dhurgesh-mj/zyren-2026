from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, UserProfileUpdate, Token
from app.utils.auth import hash_password, verify_password, create_access_token, get_current_user
from app.utils.audit import create_audit_log

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=Token)
@limiter.limit("3/minute")
async def register(user_data: UserCreate, request: Request, db: AsyncSession = Depends(get_db)):
    # Check if email exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Validate role
    valid_roles = ["student", "organizer", "dept_admin", "college_admin"]
    if user_data.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")

    # Create user
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role=user_data.role,
        department=user_data.department,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Audit log
    await create_audit_log(
        db, new_user.id, "USER_REGISTER",
        details=f"New user registered: {new_user.email}",
        ip_address=request.client.host if request.client else None
    )

    # Generate token
    token = create_access_token(data={"sub": str(new_user.id), "role": new_user.role})
    return Token(
        access_token=token,
        user=UserResponse.model_validate(new_user)
    )


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login(user_data: UserLogin, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(user_data.password, user.password_hash):
        # Audit failed login
        await create_audit_log(
            db, None, "LOGIN_FAILED",
            details=f"Failed login attempt for: {user_data.email}",
            ip_address=request.client.host if request.client else None
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Audit successful login
    await create_audit_log(
        db, user.id, "LOGIN_SUCCESS",
        details=f"User logged in: {user.email}",
        ip_address=request.client.host if request.client else None
    )

    token = create_access_token(data={"sub": str(user.id), "role": user.role})

    # Track active session in Redis
    from app.services.redis_service import track_active_session
    await track_active_session(user.id, token[:20])

    return Token(
        access_token=token,
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    profile_data: UserProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update user profile — name, department, telegram_chat_id."""
    update_data = profile_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)

    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.post("/test-telegram")
async def test_telegram(
    current_user: User = Depends(get_current_user),
):
    """Send a test Telegram notification to verify the connection."""
    if not current_user.telegram_chat_id:
        raise HTTPException(status_code=400, detail="No Telegram chat ID linked. Update your profile first.")

    from app.services.telegram_service import send_telegram_message, is_telegram_configured
    if not is_telegram_configured():
        raise HTTPException(status_code=400, detail="Telegram bot token not configured on the server.")

    success = await send_telegram_message(
        current_user.telegram_chat_id,
        f"🎉 <b>Test Notification</b>\n\n"
        f"Hi {current_user.name}! Your Telegram is linked to EventIQ Secure.\n\n"
        f"✅ You'll receive event confirmations, reminders, and QR tickets here!"
    )

    if success:
        return {"status": "sent", "message": "Test notification sent! Check your Telegram."}
    else:
        raise HTTPException(status_code=500, detail="Failed to send. Check bot token and chat ID.")
