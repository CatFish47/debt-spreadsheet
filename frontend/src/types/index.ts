export interface User {
  id: string
  name: string
}

export interface GroupMember {
  id: string
  user: User
  joined_at: string
}

export interface Group {
  id: string
  name: string
  join_code: string
  currency: string
  created_by: string
  created_at: string
  member_count: number
  members?: GroupMember[]
}

export interface TransactionSplit {
  user_id: string
  user_name: string
  amount_owed: number
}

export interface Transaction {
  id: string
  group_id: string
  payer_id: string
  payer_name: string
  amount: number
  description: string
  transaction_type: "EXPENSE" | "SETTLEMENT"
  created_at: string
  updated_at: string
  splits: TransactionSplit[]
}

export interface Balance {
  user_id: string
  user_name: string
  net_balance: number
}

export interface Transfer {
  from_user_id: string
  from_user_name: string
  to_user_id: string
  to_user_name: string
  amount: number
}

export interface BalanceSummary {
  balances: Balance[]
  suggested_transfers: Transfer[]
}

export interface HistoryEntry {
  id: string
  transaction_id: string
  changed_by: string
  changed_by_name: string
  change_type: "CREATE" | "UPDATE" | "DELETE"
  snapshot: {
    transaction: {
      id: string
      payer_id: string
      amount: number
      description: string
      transaction_type: string
    }
    splits: { user_id: string; amount_owed: number }[]
  }
  changed_at: string
}
