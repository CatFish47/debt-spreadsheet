import secrets
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    personal_key = Column(String(64), unique=True, nullable=False, index=True,
                          default=lambda: secrets.token_hex(32))
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    memberships = relationship("GroupMember", back_populates="user", cascade="all, delete-orphan")
    paid_transactions = relationship("Transaction", back_populates="payer")
    splits = relationship("TransactionSplit", back_populates="user")
    history_changes = relationship("TransactionHistory", back_populates="changed_by_user",
                                   foreign_keys="TransactionHistory.changed_by")
