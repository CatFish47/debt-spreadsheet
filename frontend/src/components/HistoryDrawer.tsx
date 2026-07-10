import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { transactionsApi } from "@/api/transactions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface Props {
  groupId: string
  txId: string | null
  onClose: () => void
}

const changeLabels = { CREATE: "Created", UPDATE: "Edited", DELETE: "Deleted" }
const changeVariants = { CREATE: "success", UPDATE: "info", DELETE: "destructive" } as const

export function HistoryDrawer({ groupId, txId, onClose }: Props) {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["history", groupId, txId],
    queryFn: () => transactionsApi.history(groupId, txId!),
    enabled: Boolean(txId),
  })

  const rollback = useMutation({
    mutationFn: (historyId: string) => transactionsApi.rollback(groupId, txId!, historyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", groupId] })
      qc.invalidateQueries({ queryKey: ["balances", groupId] })
      qc.invalidateQueries({ queryKey: ["history", groupId, txId] })
    },
  })

  if (!txId) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-background border-l shadow-xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">Change history</h2>
          <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
        </div>

        <div className="p-4 space-y-4">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {data?.map((entry, i) => (
            <div key={entry.id}>
              {i > 0 && <Separator className="mb-4" />}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant={changeVariants[entry.change_type]}>
                    {changeLabels[entry.change_type]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.changed_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">by {entry.changed_by_name}</p>
                <div className="text-xs bg-muted rounded p-2 space-y-1">
                  <p><span className="font-medium">Description:</span> {entry.snapshot.transaction.description}</p>
                  <p><span className="font-medium">Amount:</span> ${entry.snapshot.transaction.amount.toFixed(2)}</p>
                  <p><span className="font-medium">Splits:</span> {entry.snapshot.splits.map(s => `$${s.amount_owed.toFixed(2)}`).join(", ")}</p>
                </div>
                {entry.change_type !== "DELETE" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={rollback.isPending}
                    onClick={() => rollback.mutate(entry.id)}
                  >
                    Restore this version
                  </Button>
                )}
              </div>
            </div>
          ))}
          {data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
