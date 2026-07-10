import { useQuery } from "@tanstack/react-query"
import { ArrowRight } from "lucide-react"
import { transactionsApi } from "@/api/transactions"
import { balancesApi } from "@/api/balances"
import type { Balance, GroupMember } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

interface AlgorithmStep {
  from: string
  to: string
  amount: number
}

function computeSteps(balances: Balance[]): AlgorithmStep[] {
  const debtors = balances
    .filter(b => b.net_balance < 0)
    .map(b => ({ name: b.user_name, remaining: Math.abs(b.net_balance) }))
  const creditors = balances
    .filter(b => b.net_balance > 0)
    .map(b => ({ name: b.user_name, remaining: b.net_balance }))

  const steps: AlgorithmStep[] = []

  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort((a, b) => b.remaining - a.remaining)
    creditors.sort((a, b) => b.remaining - a.remaining)

    const debtor = debtors[0]
    const creditor = creditors[0]
    const amount = Math.min(debtor.remaining, creditor.remaining)

    steps.push({ from: debtor.name, to: creditor.name, amount: Math.round(amount * 100) / 100 })

    debtor.remaining = Math.round((debtor.remaining - amount) * 100) / 100
    creditor.remaining = Math.round((creditor.remaining - amount) * 100) / 100

    if (debtor.remaining === 0) debtors.shift()
    if (creditor.remaining === 0) creditors.shift()
  }

  return steps
}

interface Props {
  groupId: string
  members: GroupMember[]
}

export function BreakdownTab({ groupId, members }: Props) {
  const { data: transactions, isLoading: txLoading } = useQuery({
    queryKey: ["transactions", groupId],
    queryFn: () => transactionsApi.list(groupId),
  })

  const { data: balanceData, isLoading: balLoading } = useQuery({
    queryKey: ["balances", groupId],
    queryFn: () => balancesApi.get(groupId),
  })

  if (txLoading || balLoading) return <p className="text-sm text-muted-foreground p-4">Loading…</p>
  if (!transactions || !balanceData) return null

  const userNames: Record<string, string> = {}
  members.forEach(m => { userNames[m.user.id] = m.user.name })

  // Compute per-person paid / owed totals from raw transactions
  const paid: Record<string, number> = {}
  const owed: Record<string, number> = {}
  members.forEach(m => { paid[m.user.id] = 0; owed[m.user.id] = 0 })

  transactions.forEach(tx => {
    paid[tx.payer_id] = (paid[tx.payer_id] ?? 0) + tx.amount
    tx.splits.forEach(s => {
      owed[s.user_id] = (owed[s.user_id] ?? 0) + s.amount_owed
    })
  })

  const steps = computeSteps(balanceData.balances)

  const nonZeroBalances = balanceData.balances.filter(
    b => Math.abs(b.net_balance) >= 0.01
  )

  return (
    <div className="space-y-4 pt-2">
      {/* Step 1 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Step 1 — Net balance per person
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Net = total paid in − total share owed across all transactions
          </p>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <div className="space-y-0 text-sm">
              <div className="grid grid-cols-4 gap-2 pb-2 text-xs font-medium text-muted-foreground border-b">
                <span>Person</span>
                <span className="text-right">Paid in</span>
                <span className="text-right">Owes</span>
                <span className="text-right">Net</span>
              </div>
              {members.map(m => {
                const p = paid[m.user.id] ?? 0
                const o = owed[m.user.id] ?? 0
                const net = p - o
                return (
                  <div key={m.user.id} className="grid grid-cols-4 gap-2 py-2 border-b last:border-0 items-center">
                    <span className="font-medium truncate">{m.user.name}</span>
                    <span className="text-right text-green-700">+${p.toFixed(2)}</span>
                    <span className="text-right text-red-600">−${o.toFixed(2)}</span>
                    <span className={`text-right font-semibold ${net > 0.005 ? "text-green-700" : net < -0.005 ? "text-red-600" : "text-muted-foreground"}`}>
                      {net > 0.005 ? "+" : ""}{net.toFixed(2)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Step 2 — Greedy simplification
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Each round pairs the largest debtor with the largest creditor to minimize total transfers.
          </p>
        </CardHeader>
        <CardContent>
          {nonZeroBalances.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everyone is settled up — no transfers needed.</p>
          ) : steps.length === 0 ? (
            <p className="text-sm text-muted-foreground">All balanced.</p>
          ) : (
            <div className="space-y-3">
              {steps.map((step, i) => (
                <div key={i}>
                  {i > 0 && <Separator className="mb-3" />}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="font-mono text-xs">Round {i + 1}</Badge>
                    <span className="text-sm">
                      Largest debtor{" "}
                      <span className="font-semibold text-red-600">{step.from}</span>
                      {" "}pays largest creditor{" "}
                      <span className="font-semibold text-green-700">{step.to}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 pl-1">
                    <span className="text-sm font-medium">{step.from}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">{step.to}</span>
                    <span className="ml-auto text-sm font-bold">${step.amount.toFixed(2)}</span>
                  </div>
                </div>
              ))}
              <Separator />
              <p className="text-xs text-muted-foreground">
                {steps.length} transfer{steps.length !== 1 ? "s" : ""} needed to fully settle the group.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
