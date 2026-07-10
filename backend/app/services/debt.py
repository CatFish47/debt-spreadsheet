from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID


@dataclass
class Transfer:
    from_user_id: UUID
    to_user_id: UUID
    amount: Decimal


def minimize_debts(net_balances: dict[UUID, Decimal]) -> list[Transfer]:
    debtors = {u: abs(b) for u, b in net_balances.items() if b < 0}
    creditors = {u: b for u, b in net_balances.items() if b > 0}
    transfers: list[Transfer] = []

    while debtors and creditors:
        max_debtor = max(debtors, key=lambda u: debtors[u])
        max_creditor = max(creditors, key=lambda u: creditors[u])
        settled = min(debtors[max_debtor], creditors[max_creditor])

        transfers.append(Transfer(
            from_user_id=max_debtor,
            to_user_id=max_creditor,
            amount=round(settled, 2),
        ))

        debtors[max_debtor] -= settled
        creditors[max_creditor] -= settled

        if round(debtors[max_debtor], 2) == 0:
            del debtors[max_debtor]
        if round(creditors[max_creditor], 2) == 0:
            del creditors[max_creditor]

    return transfers
