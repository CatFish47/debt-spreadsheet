from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class UserOut(BaseModel):
    id: UUID
    name: str

    model_config = {"from_attributes": True}


class GroupCreate(BaseModel):
    name: str
    currency: str = "USD"


class GroupOut(BaseModel):
    id: UUID
    name: str
    join_code: str
    currency: str
    created_by: UUID
    created_at: datetime
    member_count: int = 0

    model_config = {"from_attributes": True}


class GroupDetailOut(GroupOut):
    members: list["MemberOut"]


class MemberOut(BaseModel):
    id: UUID
    user: UserOut
    joined_at: datetime

    model_config = {"from_attributes": True}


class JoinGroupIn(BaseModel):
    code: str
