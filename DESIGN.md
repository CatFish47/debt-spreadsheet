# Group Expense Splitting App — Design Document

## 1. Overview

A private web app for friend groups to track shared expenses and calculate who owes who. Access is controlled by personal login links (no passwords). Groups are further protected by join codes. Change history allows any transaction to be rolled back.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) + TypeScript + TailwindCSS + shadcn/ui |
| Backend | Python 3.12 + FastAPI |
| Database | PostgreSQL 16 |
| Migrations | Alembic |
| Auth | Permanent personal login links + session cookie (no passwords) |
| Container | Docker + Docker Compose |

The React build is compiled into `backend/app/static/` and served directly by FastAPI. Single container, single port exposed to Cloudflare.

---

## 3. Data Model

```
[Users] 1 ---- * [GroupMembers] * ---- 1 [Groups]
   1                                        1
   |                                        |
   *                                        *
[Transactions] 1 ----------------------- * [TransactionSplits]
      1
      |
      *
[TransactionHistory]
```

### `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR(100) | display name |
| personal_key | VARCHAR(64) UNIQUE | permanent secret used in login URL |
| created_at | TIMESTAMP | |

No email, no password. Identity is the `personal_key`.

### `groups`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR(100) | |
| join_code | VARCHAR(8) UNIQUE | short alphanumeric, auto-generated |
| created_by | UUID FK → users | group admin |
| currency | VARCHAR(3) | default "USD" |
| created_at | TIMESTAMP | |

### `group_members`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| group_id | UUID FK → groups | |
| user_id | UUID FK → users | |
| joined_at | TIMESTAMP | |
| UNIQUE | (group_id, user_id) | |

### `transactions`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| group_id | UUID FK → groups | |
| payer_id | UUID FK → users | who paid / who initiated the settlement |
| amount | DECIMAL(12,2) | total bill amount |
| description | TEXT | |
| transaction_type | ENUM('EXPENSE', 'SETTLEMENT') | default EXPENSE |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### `transaction_splits`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| transaction_id | UUID FK → transactions | |
| user_id | UUID FK → users | person who owes their share |
| amount_owed | DECIMAL(12,2) | their share of the transaction |

### `transaction_history`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| transaction_id | UUID FK → transactions | |
| changed_by | UUID FK → users | who made the change |
| change_type | ENUM('CREATE', 'UPDATE', 'DELETE') | |
| snapshot | JSONB | full transaction + splits state at this point in time |
| changed_at | TIMESTAMP | |

Every create, edit, or delete writes a snapshot row. Rollback restores the transaction and its splits from any prior snapshot.

---

## 4. Auth & Access Design

### How personal login links work

- Each user has a `personal_key` — a random 48-character hex string stored in `users`
- Their permanent login URL is: `https://debt.yourdomain.com/login?key=<personal_key>`
- Clicking it from any device sets a session cookie (90-day expiry)
- The same link works on phone, laptop, tablet — no separate links per device
- You generate this link once via CLI and text/DM it to them; they bookmark it

There is no registration page, no password form, no email. You create their account, they get a link.

### User creation CLI

Run on the server to add a new user:

```bash
python scripts/add_user.py --name "Alice"
# Output:
# Created user: Alice
# Login link: https://debt.yourdomain.com/login?key=a3f9c2b1d7e4...
# Send this link to Alice. Anyone with it can log in as Alice.
```

The script inserts a `users` row with a generated `personal_key` and prints the login URL. Uses `DATABASE_URL` from `.env`.

### Session cookie

- Clicking a valid login link sets an `httpOnly` session cookie (90 days)
- All API requests are authenticated via this cookie
- If the cookie expires, they just click their bookmarked link again

### Group-level: Join Codes

- Each group has an 8-character alphanumeric join code (e.g. `EURO2024`)
- Shareable URL: `/join/<code>`
- Must be logged in to join; members only see groups they have joined

---

## 5. Change History & Rollback

Every mutation to a transaction (create, edit, delete) appends a row to `transaction_history` with a full JSONB snapshot of the transaction and all its splits at that moment.

**What gets snapshotted:**
```json
{
  "transaction": { "id": "...", "payer_id": "...", "amount": 40.00, "description": "Dinner", ... },
  "splits": [
    { "user_id": "...", "amount_owed": 13.33 },
    { "user_id": "...", "amount_owed": 13.33 },
    { "user_id": "...", "amount_owed": 13.34 }
  ]
}
```

**Rollback:** Restoring a snapshot replaces the current transaction + splits with the snapshotted values and appends a new `UPDATE` history row so the rollback itself is auditable.

Deletes are soft-captured: the snapshot is written before deletion, so a deleted transaction can be fully restored.

---

## 6. Settlement Design

Settlements are recorded as transactions with `transaction_type = SETTLEMENT`.

**Example:** Alice pays Bob $40 to settle a debt.
- `payer_id = Alice`
- `amount = 40.00`
- `transaction_type = SETTLEMENT`
- `transaction_splits`: one row — `user_id = Bob, amount_owed = 40.00`

This flows naturally through the debt simplification algorithm with no special casing. The UI surfaces settlements with a distinct label/color.

**UI flow for recording a settlement:**
1. Balance summary shows suggested transfer: "Alice → Bob: $40"
2. Alice clicks "Mark as settled" — pre-fills a settlement transaction form
3. Alice confirms — transaction recorded, balances update immediately

---

## 7. Split Types

When creating an expense, the payer selects one of three split modes:

| Mode | Behavior |
|---|---|
| **Equal — all members** | Total divided evenly across every group member |
| **Equal — selected members** | Total divided evenly across a chosen subset (checkboxes) |
| **Fixed amounts** | Payer enters a specific dollar amount per person; UI validates sum equals total |

In all modes, the payer can exclude themselves from their own split.

---

## 8. Debt Simplification Algorithm

### Step 1 — Net balances

For each user in the group:
```
net_balance = sum(transactions where payer_id = user) - sum(transaction_splits where user_id = user)
```

Positive = owed money (creditor). Negative = owes money (debtor).

### Step 2 — Greedy minimization

```python
def minimize_debts(net_balances: dict[UUID, Decimal]) -> list[Transfer]:
    debtors = {u: abs(b) for u, b in net_balances.items() if b < 0}
    creditors = {u: b for u, b in net_balances.items() if b > 0}
    transfers = []

    while debtors and creditors:
        max_debtor = max(debtors, key=debtors.get)
        max_creditor = max(creditors, key=creditors.get)
        settled = min(debtors[max_debtor], creditors[max_creditor])

        transfers.append(Transfer(from_user=max_debtor, to_user=max_creditor, amount=round(settled, 2)))

        debtors[max_debtor] -= settled
        creditors[max_creditor] -= settled

        if round(debtors[max_debtor], 2) == 0:
            del debtors[max_debtor]
        if round(creditors[max_creditor], 2) == 0:
            del creditors[max_creditor]

    return transfers
```

---

## 9. API Endpoints

All endpoints prefixed `/api`. Session cookie required on all except `/auth/login`.

### Auth
| Method | Path | Description |
|---|---|---|
| GET | `/auth/login?key=<personal_key>` | Validate key → set session cookie |
| POST | `/auth/logout` | Clear session cookie |
| GET | `/auth/me` | Current user info |

### Groups
| Method | Path | Description |
|---|---|---|
| GET | `/groups` | List groups the current user belongs to |
| POST | `/groups` | Create a new group |
| GET | `/groups/{id}` | Group detail + member list |
| POST | `/groups/{id}/join` | Join via `{ "code": "EURO2024" }` |
| DELETE | `/groups/{id}/members/me` | Leave a group |

### Transactions
| Method | Path | Description |
|---|---|---|
| GET | `/groups/{id}/transactions` | List all transactions (paginated) |
| POST | `/groups/{id}/transactions` | Create expense or settlement |
| GET | `/groups/{id}/transactions/{tid}` | Transaction detail |
| PUT | `/groups/{id}/transactions/{tid}` | Edit (any group member) |
| DELETE | `/groups/{id}/transactions/{tid}` | Delete (any group member) |
| GET | `/groups/{id}/transactions/{tid}/history` | Full change history |
| POST | `/groups/{id}/transactions/{tid}/rollback/{history_id}` | Restore a prior snapshot |

### Balances
| Method | Path | Description |
|---|---|---|
| GET | `/groups/{id}/balances` | Net balances + suggested transfers |

---

## 10. Frontend Pages & Components

```
/login?key=...          → validates key, sets cookie, redirects to /groups
/join/:code             → joins group (prompts login first if no cookie)
/groups                 → GroupListPage (dashboard)
/groups/:id             → GroupDetailPage
  └── tabs: Transactions | Balances
/groups/:id/transactions/:tid/history  → HistoryPage
```

Key components:
- `TransactionModal` — create/edit expense or settlement; includes split mode selector + participant checkboxes
- `BalanceSummary` — net balances per person + suggested transfers with "Mark settled" buttons
- `TransactionList` — paginated list with EXPENSE / SETTLEMENT badges and edit/delete/history actions
- `HistoryDrawer` — timeline of changes with "Restore this version" button per entry
- `GroupJoinCard` — displays join code + copy shareable link button

---

## 11. Project File Structure

```
debt-spreadsheet/
├── docker-compose.yml
├── .env.example
├── Makefile
├── scripts/
│   └── add_user.py            # CLI: create user + print login link
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/
│   └── app/
│       ├── main.py            # FastAPI app, mounts static dir
│       ├── config.py          # Settings from env vars
│       ├── database.py        # SQLAlchemy engine + session
│       ├── models/
│       │   ├── user.py
│       │   ├── group.py
│       │   ├── transaction.py
│       │   └── history.py
│       ├── schemas/
│       │   ├── auth.py
│       │   ├── group.py
│       │   └── transaction.py
│       ├── routers/
│       │   ├── auth.py
│       │   ├── groups.py
│       │   ├── transactions.py
│       │   └── balances.py
│       ├── services/
│       │   ├── auth.py        # session cookie helpers
│       │   ├── history.py     # snapshot + rollback logic
│       │   └── debt.py        # minimize_debts algorithm
│       └── static/            # React build output (gitignored)
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/               # Typed fetch wrappers per resource
        ├── components/
        │   ├── ui/            # shadcn/ui primitives
        │   ├── TransactionModal.tsx
        │   ├── BalanceSummary.tsx
        │   ├── TransactionList.tsx
        │   └── HistoryDrawer.tsx
        └── pages/
            ├── GroupListPage.tsx
            └── GroupDetailPage.tsx
```

---

## 12. Deployment

### docker-compose.yml

```yaml
services:
  app:
    build: ./backend
    ports:
      - "3001:3001"
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: debtapp
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d debtapp"]
      interval: 5s
      retries: 5
    restart: unless-stopped
```

### `.env.example`

```env
DATABASE_URL=postgresql://app:changeme@db:5432/debtapp
SECRET_KEY=change-this-to-a-long-random-string
SESSION_EXPIRE_DAYS=90
APP_URL=https://debt.yourdomain.com
```

### Startup sequence (baked into Dockerfile entrypoint)

1. Run `alembic upgrade head` (migrations, safe to re-run)
2. Start Uvicorn on port 3001

### Deploy workflow

```bash
cp .env.example .env                          # fill in DB_PASSWORD, SECRET_KEY, APP_URL
docker compose up -d                          # build + start
docker compose exec app python scripts/add_user.py --name "Alice"  # create first user
```

Cloudflare Zero Trust tunnel routes `debt.yourdomain.com` → `localhost:3001`.

---

## 13. Out of Scope for V1

- Email notifications
- Multi-currency (all groups are USD)
- Transaction attachments/receipts
- Admin UI (user management is CLI-only)
