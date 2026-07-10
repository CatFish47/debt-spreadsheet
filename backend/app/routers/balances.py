from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.group import Group, GroupMember
from app.models.transaction import Transaction, TransactionSplit
from app.models.user import User
from app.schemas.transaction import BalanceOut, BalanceSummaryOut, TransferOut
from app.services.debt import minimize_debts

router = APIRouter()


@router.get("/groups/{group_id}/balances", response_model=BalanceSummaryOut)
def get_balances(group_id: UUID, current_user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    if not (db.query(GroupMember)
            .filter(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id)
            .first()):
        raise HTTPException(status_code=403, detail="Not a member of this group")

    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    members = db.query(GroupMember).filter(GroupMember.group_id == group_id).all()
    user_map: dict[UUID, str] = {m.user_id: m.user.name for m in members}

    net: dict[UUID, Decimal] = {uid: Decimal("0") for uid in user_map}

    txs = db.query(Transaction).filter(Transaction.group_id == group_id).all()
    for tx in txs:
        net[tx.payer_id] = net.get(tx.payer_id, Decimal("0")) + tx.amount

    splits = (db.query(TransactionSplit)
              .join(Transaction)
              .filter(Transaction.group_id == group_id)
              .all())
    for s in splits:
        net[s.user_id] = net.get(s.user_id, Decimal("0")) - s.amount_owed

    balances = [
        BalanceOut(user_id=uid, user_name=user_map[uid], net_balance=round(bal, 2))
        for uid, bal in net.items()
    ]

    transfers_raw = minimize_debts(net)
    transfers = [
        TransferOut(
            from_user_id=t.from_user_id,
            from_user_name=user_map.get(t.from_user_id, "Unknown"),
            to_user_id=t.to_user_id,
            to_user_name=user_map.get(t.to_user_id, "Unknown"),
            amount=t.amount,
        )
        for t in transfers_raw
    ]

    return BalanceSummaryOut(balances=balances, suggested_transfers=transfers)
