import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class ChangeType(str, enum.Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


class TransactionHistory(Base):
    __tablename__ = "transaction_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id"), nullable=False)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    change_type = Column(Enum(ChangeType), nullable=False)
    snapshot = Column(JSONB, nullable=False)
    changed_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    transaction = relationship("Transaction", back_populates="history")
    changed_by_user = relationship("User", back_populates="history_changes",
                                   foreign_keys=[changed_by])
