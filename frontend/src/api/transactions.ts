import { api } from "./client"
import type { HistoryEntry, Transaction } from "@/types"

export interface TransactionPayload {
  description: string
  amount: number
  payer_id: string
  transaction_type?: "EXPENSE" | "SETTLEMENT"
  split_mode?: "equal_all" | "equal_selected" | "fixed"
  selected_user_ids?: string[]
  splits?: { user_id: string; amount_owed: number }[]
}

export const transactionsApi = {
  list: (groupId: string) =>
    api.get<Transaction[]>(`/groups/${groupId}/transactions`),
  create: (groupId: string, payload: TransactionPayload) =>
    api.post<Transaction>(`/groups/${groupId}/transactions`, payload),
  update: (groupId: string, txId: string, payload: TransactionPayload) =>
    api.put<Transaction>(`/groups/${groupId}/transactions/${txId}`, payload),
  delete: (groupId: string, txId: string) =>
    api.delete<void>(`/groups/${groupId}/transactions/${txId}`),
  history: (groupId: string, txId: string) =>
    api.get<HistoryEntry[]>(`/groups/${groupId}/transactions/${txId}/history`),
  rollback: (groupId: string, txId: string, historyId: string) =>
    api.post<Transaction>(
      `/groups/${groupId}/transactions/${txId}/rollback/${historyId}`
    ),
}
