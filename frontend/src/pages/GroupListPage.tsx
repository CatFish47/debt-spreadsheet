import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, LogOut, Users } from "lucide-react"
import { groupsApi } from "@/api/groups"
import { authApi } from "@/api/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function GroupListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: user } = useQuery({ queryKey: ["me"], queryFn: authApi.me })
  const { data: groups, isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: groupsApi.list,
  })

  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newName, setNewName] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [formError, setFormError] = useState("")

  const createMutation = useMutation({
    mutationFn: () => groupsApi.create(newName),
    onSuccess: g => {
      qc.invalidateQueries({ queryKey: ["groups"] })
      setShowCreate(false)
      setNewName("")
      navigate(`/groups/${g.id}`)
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const joinMutation = useMutation({
    mutationFn: () => groupsApi.joinByCode(joinCode.trim().toUpperCase()),
    onSuccess: g => {
      qc.invalidateQueries({ queryKey: ["groups"] })
      setShowJoin(false)
      setJoinCode("")
      navigate(`/groups/${g.id}`)
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => { window.location.href = "/login" },
  })

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <h1 className="font-semibold">Debt Splitter</h1>
        <div className="flex items-center gap-2">
          {user && <span className="text-sm text-muted-foreground">{user.name}</span>}
          <Button size="sm" variant="ghost" onClick={() => logoutMutation.mutate()}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Your groups</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setFormError(""); setShowJoin(true) }}>
              Join
            </Button>
            <Button size="sm" onClick={() => { setFormError(""); setShowCreate(true) }}>
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
          </div>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {groups?.map(g => (
          <Card key={g.id} className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => navigate(`/groups/${g.id}`)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{g.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {g.member_count} members · {g.currency}
              </p>
            </CardContent>
          </Card>
        ))}

        {!isLoading && groups?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No groups yet. Create one or join with a code.
          </p>
        )}
      </main>

      <Dialog open={showCreate} onOpenChange={v => !v && setShowCreate(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New group</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); setFormError(""); createMutation.mutate() }} className="space-y-4">
            <div className="space-y-1">
              <Label>Group name</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Europe Trip 2025" autoFocus />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={!newName.trim() || createMutation.isPending}>Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showJoin} onOpenChange={v => !v && setShowJoin(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Join a group</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); setFormError(""); joinMutation.mutate() }} className="space-y-4">
            <div className="space-y-1">
              <Label>Join code</Label>
              <Input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="EURO2024" autoFocus
                className="font-mono tracking-widest uppercase" maxLength={8} />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowJoin(false)}>Cancel</Button>
              <Button type="submit" disabled={!joinCode.trim() || joinMutation.isPending}>Join</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
