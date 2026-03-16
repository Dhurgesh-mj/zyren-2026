from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog


async def create_audit_log(
    db: AsyncSession,
    user_id: int | None,
    action: str,
    details: str | None = None,
    ip_address: str | None = None,
):
    """Create an audit log entry."""
    log = AuditLog(
        user_id=user_id,
        action=action,
        details=details,
        ip_address=ip_address,
    )
    db.add(log)
    await db.commit()
    return log
