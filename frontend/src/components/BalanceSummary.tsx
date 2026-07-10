import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight } from "lucide-react"
import { balancesApi } from "@/api/balances"
import type { GroupMember, Transfer } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { TransactionModal } from "./TransactionModal"

interface Props {
  groupId: string
  members: GroupMember[]
  currentUserId: string
}

export function BalanceSummary({ groupId, members, currentUserId }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["balances", groupId],
    queryFn: () => balancesApi.get(groupId),
  })
  const [settleTransfer, setSettleTransfer] = useState<Transfer | null>(null)

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Loading balances…</p>
  if (error) return <p className="text-sm text-destructive p-4">Failed to load balances.</p>
  if (!data) return null

  function settlePrefill(t: Transfer) {
    return {
      transaction_type: "SETTLEMENT" as const,
      description: "Settlement",
      amount: t.amount,
      payer_id: t.from_user_id,
      splits: [{ user_id: t.to_user_id, amount_owed: t.amount }],
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Balances</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.balances.map(b => (
            <div key={b.user_id} className="flex items-center justify-between text-sm">
              <span>{b.user_name}</span>
              <Badge variant={b.net_balance > 0 ? "success" : b.net_balance < 0 ? "destructive" : "secondary"}>
                {b.net_balance > 0 ? "+" : ""}${Math.abs(b.net_balance).toFixed(2)}
              </Badge>
            </div>
          ))}
          {data.balances.length === 0 && (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          )}
        </CardContent>
      </Card>

      {data.suggested_transfers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Suggested settlements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.suggested_transfers.map((t, i) => (
              <div key={i}>
                {i > 0 && <Separator className="mb-3" />}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{t.from_user_name}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{t.to_user_name}</span>
                    <span className="text-muted-foreground">${t.amount.toFixed(2)}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSettleTransfer(t)}>
                    Mark settled
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {data.suggested_transfers.length === 0 && data.balances.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">All settled up!</p>
      )}

      {settleTransfer && (
        <TransactionModal
          groupId={groupId}
          members={members}
          currentUserId={currentUserId}
          prefill={settlePrefill(settleTransfer)}
          open={true}
          onClose={() => setSettleTransfer(null)}
        />
      )}
    </div>
  )
}
