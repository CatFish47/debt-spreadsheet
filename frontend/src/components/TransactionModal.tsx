import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { transactionsApi, type TransactionPayload } from "@/api/transactions"
import type { GroupMember, Transaction } from "@/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type SplitMode = "equal_all" | "equal_selected" | "fixed"

interface Props {
  groupId: string
  members: GroupMember[]
  currentUserId: string
  transaction?: Transaction
  prefill?: Partial<TransactionPayload>
  open: boolean
  onClose: () => void
}

export function TransactionModal({ groupId, members, currentUserId, transaction, prefill, open, onClose }: Props) {
  const qc = useQueryClient()
  const isEdit = Boolean(transaction)

  const [txType, setTxType] = useState<"EXPENSE" | "SETTLEMENT">(
    transaction?.transaction_type ?? prefill?.transaction_type ?? "EXPENSE"
  )
  const [description, setDescription] = useState(transaction?.description ?? prefill?.description ?? "")
  const [amount, setAmount] = useState(transaction?.amount?.toString() ?? prefill?.amount?.toString() ?? "")
  const [payerId, setPayerId] = useState(transaction?.payer_id ?? prefill?.payer_id ?? currentUserId)
  const [splitMode, setSplitMode] = useState<SplitMode>("equal_all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(members.map(m => m.user.id)))
  const [fixedAmounts, setFixedAmounts] = useState<Record<string, string>>({})
  const [settleTo, setSettleTo] = useState<string>(prefill?.splits?.[0]?.user_id ?? "")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setTxType(transaction?.transaction_type ?? prefill?.transaction_type ?? "EXPENSE")
    setDescription(transaction?.description ?? prefill?.description ?? "")
    setAmount(transaction?.amount?.toString() ?? prefill?.amount?.toString() ?? "")
    setPayerId(transaction?.payer_id ?? prefill?.payer_id ?? currentUserId)
    setSettleTo(prefill?.splits?.[0]?.user_id ?? "")
    setError("")
    if (transaction) {
      setSplitMode("fixed")
      const fixed: Record<string, string> = {}
      transaction.splits.forEach(s => { fixed[s.user_id] = s.amount_owed.toString() })
      setFixedAmounts(fixed)
      setSelectedIds(new Set(transaction.splits.map(s => s.user_id)))
    } else {
      setSplitMode("equal_all")
      setSelectedIds(new Set(members.map(m => m.user.id)))
      setFixedAmounts({})
    }
  }, [open, transaction, prefill, currentUserId, members])

  const mutation = useMutation({
    mutationFn: (payload: TransactionPayload) =>
      isEdit
        ? transactionsApi.update(groupId, transaction!.id, payload)
        : transactionsApi.create(groupId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", groupId] })
      qc.invalidateQueries({ queryKey: ["balances", groupId] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  function buildPayload(): TransactionPayload | null {
    const amt = parseFloat(amount)
    if (!description.trim() || isNaN(amt) || amt <= 0) {
      setError("Description and a positive amount are required.")
      return null
    }

    if (txType === "SETTLEMENT") {
      if (!settleTo) { setError("Select who to pay."); return null }
      return {
        description: description || "Settlement",
        amount: amt,
        payer_id: payerId,
        transaction_type: "SETTLEMENT",
        split_mode: "fixed",
        splits: [{ user_id: settleTo, amount_owed: amt }],
      }
    }

    if (splitMode === "fixed") {
      const splits = Object.entries(fixedAmounts)
        .filter(([, v]) => parseFloat(v) > 0)
        .map(([user_id, v]) => ({ user_id, amount_owed: parseFloat(v) }))
      const total = splits.reduce((s, x) => s + x.amount_owed, 0)
      if (Math.abs(total - amt) > 0.01) {
        setError(`Split total $${total.toFixed(2)} must equal $${amt.toFixed(2)}`)
        return null
      }
      return { description, amount: amt, payer_id: payerId, transaction_type: "EXPENSE", split_mode: "fixed", splits }
    }

    if (splitMode === "equal_selected" && selectedIds.size === 0) {
      setError("Select at least one person.")
      return null
    }

    return {
      description,
      amount: amt,
      payer_id: payerId,
      transaction_type: "EXPENSE",
      split_mode: splitMode,
      selected_user_ids: splitMode === "equal_selected" ? [...selectedIds] : [],
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const payload = buildPayload()
    if (payload) mutation.mutate(payload)
  }

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const otherMembers = members.filter(m => m.user.id !== payerId)

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            {(["EXPENSE", "SETTLEMENT"] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTxType(t)}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium border transition-colors ${txType === t ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-accent"}`}
              >
                {t === "EXPENSE" ? "Expense" : "Settlement"}
              </button>
            ))}
          </div>

          {txType === "EXPENSE" && (
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Dinner, Uber, etc." />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Amount ($)</Label>
              <Input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Paid by</Label>
              <Select value={payerId} onValueChange={setPayerId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {members.map(m => <SelectItem key={m.user.id} value={m.user.id}>{m.user.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {txType === "SETTLEMENT" ? (
            <div className="space-y-1">
              <Label>Paying back</Label>
              <Select value={settleTo} onValueChange={setSettleTo}>
                <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                <SelectContent>
                  {otherMembers.map(m => <SelectItem key={m.user.id} value={m.user.id}>{m.user.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Split</Label>
              <div className="flex gap-2">
                {([["equal_all", "Evenly (all)"], ["equal_selected", "Evenly (select)"], ["fixed", "Custom"]] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSplitMode(mode)}
                    className={`flex-1 rounded-md py-1 text-xs font-medium border transition-colors ${splitMode === mode ? "bg-secondary text-secondary-foreground border-secondary-foreground/20" : "border-input hover:bg-accent"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {(splitMode === "equal_selected" || splitMode === "fixed") && (
                <div className="space-y-2 pt-1">
                  {members.map(m => (
                    <div key={m.user.id} className="flex items-center gap-3">
                      {splitMode === "equal_selected" && (
                        <Checkbox
                          checked={selectedIds.has(m.user.id)}
                          onCheckedChange={() => toggleSelected(m.user.id)}
                        />
                      )}
                      <span className="flex-1 text-sm">{m.user.name}</span>
                      {splitMode === "fixed" && (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-24"
                          placeholder="0.00"
                          value={fixedAmounts[m.user.id] ?? ""}
                          onChange={e => setFixedAmounts(p => ({ ...p, [m.user.id]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
