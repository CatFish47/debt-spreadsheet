from uuid import UUID

from sqlalchemy.orm import Session

from app.models.history import ChangeType, TransactionHistory
from app.models.transaction import Transaction, TransactionSplit


def snapshot(db: Session, transaction: Transaction, changed_by: UUID,
             change_type: ChangeType) -> None:
    splits = (db.query(TransactionSplit)
              .filter(TransactionSplit.transaction_id == transaction.id)
              .all())

    data = {
        "transaction": {
            "id": str(transaction.id),
            "group_id": str(transaction.group_id),
            "payer_id": str(transaction.payer_id),
            "amount": float(transaction.amount),
            "description": transaction.description,
            "transaction_type": transaction.transaction_type,
        },
        "splits": [
            {"user_id": str(s.user_id), "amount_owed": float(s.amount_owed)}
            for s in splits
        ],
    }

    db.add(TransactionHistory(
        transaction_id=transaction.id,
        changed_by=changed_by,
        change_type=change_type,
        snapshot=data,
    ))
