import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { groupsApi } from "@/api/groups"

export function JoinRedirect() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [error, setError] = useState("")

  useEffect(() => {
    if (!code) return
    groupsApi.joinByCode(code)
      .then(g => navigate(`/groups/${g.id}`, { replace: true }))
      .catch((e: Error) => {
        if (e.message === "Unauthorized") return
        setError(e.message)
      })
  }, [code, navigate])

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-destructive text-sm">{error}</p>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Joining group…</p>
    </div>
  )
}
