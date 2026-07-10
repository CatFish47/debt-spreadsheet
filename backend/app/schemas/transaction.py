from datetime import datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, field_validator


class SplitMode(str, Enum):
    EQUAL_ALL = "equal_all"
    EQUAL_SELECTED = "equal_selected"
    FIXED = "fixed"


class SplitIn(BaseModel):
    user_id: UUID
    amount_owed: Decimal


class TransactionCreate(BaseModel):
    description: str
    amount: Decimal
    payer_id: UUID
    transaction_type: str = "EXPENSE"
    split_mode: SplitMode = SplitMode.EQUAL_ALL
    selected_user_ids: list[UUID] = []
    splits: list[SplitIn] = []

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Amount must be positive")
        return v


class SplitOut(BaseModel):
    user_id: UUID
    user_name: str
    amount_owed: float

    model_config = {"from_attributes": True}


class TransactionOut(BaseModel):
    id: UUID
    group_id: UUID
    payer_id: UUID
    payer_name: str
    amount: float
    description: str
    transaction_type: str
    created_at: datetime
    updated_at: datetime
    splits: list[SplitOut]

    model_config = {"from_attributes": True}


class HistoryOut(BaseModel):
    id: UUID
    transaction_id: UUID
    changed_by: UUID
    changed_by_name: str
    change_type: str
    snapshot: dict
    changed_at: datetime

    model_config = {"from_attributes": True}


class BalanceOut(BaseModel):
    user_id: UUID
    user_name: str
    net_balance: float


class TransferOut(BaseModel):
    from_user_id: UUID
    from_user_name: str
    to_user_id: UUID
    to_user_name: str
    amount: float


class BalanceSummaryOut(BaseModel):
    balances: list[BalanceOut]
    suggested_transfers: list[TransferOut]
