from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(200), nullable=False)
    details = Column(String(1000), nullable=True)
    ip_address = Column(String(45), nullable=True)
    timestamp = Column(DateTime, server_default=func.now())
