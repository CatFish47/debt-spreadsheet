import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class TransactionType(str, enum.Enum):
    EXPENSE = "EXPENSE"
    SETTLEMENT = "SETTLEMENT"


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False)
    payer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    description = Column(Text, nullable=False)
    transaction_type = Column(Enum(TransactionType), nullable=False,
                              default=TransactionType.EXPENSE)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    group = relationship("Group", back_populates="transactions")
    payer = relationship("User", back_populates="paid_transactions")
    splits = relationship("TransactionSplit", back_populates="transaction",
                          cascade="all, delete-orphan")
    history = relationship("TransactionHistory", back_populates="transaction",
                           cascade="all, delete-orphan")


class TransactionSplit(Base):
    __tablename__ = "transaction_splits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    amount_owed = Column(Numeric(12, 2), nullable=False)

    transaction = relationship("Transaction", back_populates="splits")
    user = relationship("User", back_populates="splits")
