from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.group import GroupMember
from app.models.history import ChangeType
from app.models.transaction import Transaction, TransactionSplit, TransactionType
from app.models.user import User
from app.schemas.transaction import (
    HistoryOut,
    SplitMode,
    SplitOut,
    TransactionCreate,
    TransactionOut,
)
from app.services import history as history_svc

router = APIRouter()


def _assert_member(db: Session, group_id: UUID, user_id: UUID):
    if not (db.query(GroupMember)
            .filter(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
            .first()):
        raise HTTPException(status_code=403, detail="Not a member of this group")


def _build_splits(db: Session, body: TransactionCreate, group_id: UUID) -> list[dict]:
    """Return list of {user_id, amount_owed} dicts based on split mode."""
    if body.split_mode == SplitMode.FIXED:
        if not body.splits:
            raise HTTPException(status_code=422, detail="splits required for fixed mode")
        total = sum(s.amount_owed for s in body.splits)
        if round(total, 2) != round(body.amount, 2):
            raise HTTPException(status_code=422,
                                detail=f"Split sum {total} does not equal amount {body.amount}")
        return [{"user_id": s.user_id, "amount_owed": s.amount_owed} for s in body.splits]

    if body.split_mode == SplitMode.EQUAL_SELECTED:
        if not body.selected_user_ids:
            raise HTTPException(status_code=422, detail="selected_user_ids required")
        user_ids = body.selected_user_ids
    else:
        members = (db.query(GroupMember)
                   .filter(GroupMember.group_id == group_id)
                   .all())
        user_ids = [m.user_id for m in members]

    n = len(user_ids)
    base = (body.amount / n).quantize(Decimal("0.01"))
    remainder = body.amount - base * n
    splits = []
    for i, uid in enumerate(user_ids):
        extra = Decimal("0.01") if i == 0 and remainder != 0 else Decimal("0")
        splits.append({"user_id": uid, "amount_owed": base + extra})
    return splits


def _tx_out(db: Session, tx: Transaction) -> TransactionOut:
    splits_out = [
        SplitOut(
            user_id=s.user_id,
            user_name=s.user.name,
            amount_owed=s.amount_owed,
        )
        for s in tx.splits
    ]
    return TransactionOut(
        id=tx.id,
        group_id=tx.group_id,
        payer_id=tx.payer_id,
        payer_name=tx.payer.name,
        amount=tx.amount,
        description=tx.description,
        transaction_type=tx.transaction_type,
        created_at=tx.created_at,
        updated_at=tx.updated_at,
        splits=splits_out,
    )


@router.get("/groups/{group_id}/transactions", response_model=list[TransactionOut])
def list_transactions(group_id: UUID, current_user: User = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    _assert_member(db, group_id, current_user.id)
    txs = (db.query(Transaction)
           .filter(Transaction.group_id == group_id)
           .order_by(Transaction.created_at.desc())
           .all())
    return [_tx_out(db, tx) for tx in txs]


@router.post("/groups/{group_id}/transactions", response_model=TransactionOut, status_code=201)
def create_transaction(group_id: UUID, body: TransactionCreate,
                       current_user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    _assert_member(db, group_id, current_user.id)
    _assert_member(db, group_id, body.payer_id)

    splits_data = _build_splits(db, body, group_id)

    tx = Transaction(
        group_id=group_id,
        payer_id=body.payer_id,
        amount=body.amount,
        description=body.description,
        transaction_type=TransactionType(body.transaction_type),
    )
    db.add(tx)
    db.flush()

    for s in splits_data:
        db.add(TransactionSplit(transaction_id=tx.id, **s))

    db.flush()
    history_svc.snapshot(db, tx, current_user.id, ChangeType.CREATE)
    db.commit()
    db.refresh(tx)
    return _tx_out(db, tx)


@router.get("/groups/{group_id}/transactions/{tx_id}", response_model=TransactionOut)
def get_transaction(group_id: UUID, tx_id: UUID,
                    current_user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    _assert_member(db, group_id, current_user.id)
    tx = db.query(Transaction).filter(Transaction.id == tx_id,
                                      Transaction.group_id == group_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return _tx_out(db, tx)


@router.put("/groups/{group_id}/transactions/{tx_id}", response_model=TransactionOut)
def update_transaction(group_id: UUID, tx_id: UUID, body: TransactionCreate,
                       current_user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    _assert_member(db, group_id, current_user.id)
    tx = db.query(Transaction).filter(Transaction.id == tx_id,
                                      Transaction.group_id == group_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    splits_data = _build_splits(db, body, group_id)

    history_svc.snapshot(db, tx, current_user.id, ChangeType.UPDATE)

    tx.payer_id = body.payer_id
    tx.amount = body.amount
    tx.description = body.description
    tx.transaction_type = TransactionType(body.transaction_type)

    for s in tx.splits:
        db.delete(s)
    db.flush()
    for s in splits_data:
        db.add(TransactionSplit(transaction_id=tx.id, **s))

    db.commit()
    db.refresh(tx)
    return _tx_out(db, tx)


@router.delete("/groups/{group_id}/transactions/{tx_id}", status_code=204)
def delete_transaction(group_id: UUID, tx_id: UUID,
                       current_user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    _assert_member(db, group_id, current_user.id)
    tx = db.query(Transaction).filter(Transaction.id == tx_id,
                                      Transaction.group_id == group_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    history_svc.snapshot(db, tx, current_user.id, ChangeType.DELETE)
    db.flush()
    db.delete(tx)
    db.commit()


@router.get("/groups/{group_id}/transactions/{tx_id}/history", response_model=list[HistoryOut])
def get_history(group_id: UUID, tx_id: UUID,
                current_user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    _assert_member(db, group_id, current_user.id)
    tx = db.query(Transaction).filter(Transaction.id == tx_id,
                                      Transaction.group_id == group_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    from app.models.history import TransactionHistory
    entries = (db.query(TransactionHistory)
               .filter(TransactionHistory.transaction_id == tx_id)
               .order_by(TransactionHistory.changed_at.desc())
               .all())
    return [
        HistoryOut(
            id=e.id,
            transaction_id=e.transaction_id,
            changed_by=e.changed_by,
            changed_by_name=e.changed_by_user.name,
            change_type=e.change_type,
            snapshot=e.snapshot,
            changed_at=e.changed_at,
        )
        for e in entries
    ]


@router.post("/groups/{group_id}/transactions/{tx_id}/rollback/{history_id}",
             response_model=TransactionOut)
def rollback_transaction(group_id: UUID, tx_id: UUID, history_id: UUID,
                         current_user: User = Depends(get_current_user),
                         db: Session = Depends(get_db)):
    _assert_member(db, group_id, current_user.id)
    tx = db.query(Transaction).filter(Transaction.id == tx_id,
                                      Transaction.group_id == group_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    from app.models.history import TransactionHistory
    entry = db.query(TransactionHistory).filter(TransactionHistory.id == history_id,
                                                TransactionHistory.transaction_id == tx_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="History entry not found")

    snap = entry.snapshot
    tx_snap = snap["transaction"]

    history_svc.snapshot(db, tx, current_user.id, ChangeType.UPDATE)

    tx.payer_id = tx_snap["payer_id"]
    tx.amount = Decimal(str(tx_snap["amount"]))
    tx.description = tx_snap["description"]
    tx.transaction_type = TransactionType(tx_snap["transaction_type"])

    for s in tx.splits:
        db.delete(s)
    db.flush()
    for s in snap["splits"]:
        db.add(TransactionSplit(
            transaction_id=tx.id,
            user_id=s["user_id"],
            amount_owed=Decimal(str(s["amount_owed"])),
        ))

    db.commit()
    db.refresh(tx)
    return _tx_out(db, tx)
