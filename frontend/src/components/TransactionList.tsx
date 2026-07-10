import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { History, Pencil, Trash2 } from "lucide-react"
import { transactionsApi } from "@/api/transactions"
import type { GroupMember, Transaction } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TransactionModal } from "./TransactionModal"
import { HistoryDrawer } from "./HistoryDrawer"

interface Props {
  groupId: string
  members: GroupMember[]
  currentUserId: string
}

export function TransactionList({ groupId, members, currentUserId }: Props) {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ["transactions", groupId],
    queryFn: () => transactionsApi.list(groupId),
  })

  const [editing, setEditing] = useState<Transaction | null>(null)
  const [historyTxId, setHistoryTxId] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (txId: string) => transactionsApi.delete(groupId, txId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", groupId] })
      qc.invalidateQueries({ queryKey: ["balances", groupId] })
    },
  })

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Loading…</p>
  if (error) return <p className="text-sm text-destructive p-4">Failed to load transactions.</p>
  if (!data?.length) return <p className="text-sm text-muted-foreground text-center py-8">No transactions yet. Add one above.</p>

  function confirmDelete(tx: Transaction) {
    if (confirm(`Delete "${tx.description}"? This can be undone via history.`)) {
      deleteMutation.mutate(tx.id)
    }
  }

  return (
    <>
      <div className="space-y-2">
        {data.map(tx => (
          <div key={tx.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{tx.description}</span>
                  <Badge variant={tx.transaction_type === "SETTLEMENT" ? "info" : "secondary"}>
                    {tx.transaction_type === "SETTLEMENT" ? "Settlement" : "Expense"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {tx.payer_name} paid ${Number(tx.amount).toFixed(2)} · {new Date(tx.created_at).toLocaleDateString()}
                </p>
                {tx.splits.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Split: {tx.splits.map(s => `${s.user_name} $${Number(s.amount_owed).toFixed(2)}`).join(", ")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setHistoryTxId(tx.id)}>
                  <History className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(tx)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => confirmDelete(tx)} disabled={deleteMutation.isPending}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <TransactionModal
          groupId={groupId}
          members={members}
          currentUserId={currentUserId}
          transaction={editing}
          open={true}
          onClose={() => setEditing(null)}
        />
      )}

      <HistoryDrawer
        groupId={groupId}
        txId={historyTxId}
        onClose={() => setHistoryTxId(null)}
      />
    </>
  )
}
