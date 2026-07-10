import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Plus, LogOut } from "lucide-react"
import { groupsApi } from "@/api/groups"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TransactionModal } from "@/components/TransactionModal"
import { TransactionList } from "@/components/TransactionList"
import { BalanceSummary } from "@/components/BalanceSummary"
import { GroupJoinCard } from "@/components/GroupJoinCard"
import { authApi } from "@/api/auth"

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)

  const { data: user } = useQuery({ queryKey: ["me"], queryFn: authApi.me })
  const { data: group, isLoading, error } = useQuery({
    queryKey: ["group", id],
    queryFn: () => groupsApi.get(id!),
    enabled: Boolean(id),
  })

  const leaveMutation = useMutation({
    mutationFn: () => groupsApi.leave(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] })
      navigate("/groups")
    },
  })

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading…</p></div>
  if (error || !group) return <div className="min-h-screen flex items-center justify-center"><p className="text-destructive">Group not found.</p></div>

  const members = group.members ?? []
  const currentUserId = user?.id ?? ""

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center gap-3">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate("/groups")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-semibold flex-1 truncate">{group.name}</h1>
        <Button size="sm" variant="ghost" className="text-muted-foreground text-xs gap-1"
          onClick={() => { if (confirm("Leave this group?")) leaveMutation.mutate() }}>
          <LogOut className="h-3.5 w-3.5" /> Leave
        </Button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <GroupJoinCard group={group} />

        <div className="flex justify-end">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add transaction
          </Button>
        </div>

        <Tabs defaultValue="transactions">
          <TabsList className="w-full">
            <TabsTrigger value="transactions" className="flex-1">Transactions</TabsTrigger>
            <TabsTrigger value="balances" className="flex-1">Balances</TabsTrigger>
          </TabsList>
          <TabsContent value="transactions">
            <TransactionList groupId={id!} members={members} currentUserId={currentUserId} />
          </TabsContent>
          <TabsContent value="balances">
            <BalanceSummary groupId={id!} members={members} currentUserId={currentUserId} />
          </TabsContent>
        </Tabs>
      </main>

      <TransactionModal
        groupId={id!}
        members={members}
        currentUserId={currentUserId}
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />
    </div>
  )
}
