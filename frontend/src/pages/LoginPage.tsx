import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { authApi } from "@/api/auth"

export function LoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState("")
  const key = params.get("key")

  useEffect(() => {
    if (!key) return
    authApi.login(key)
      .then(() => navigate("/groups", { replace: true }))
      .catch(() => setError("Invalid or expired link. Ask for a new one."))
  }, [key, navigate])

  if (key && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Logging in…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3 max-w-sm px-4">
        <h1 className="text-2xl font-bold">Debt Splitter</h1>
        {error ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Use your personal login link to access the app. Contact the group admin if you need one.
          </p>
        )}
      </div>
    </div>
  )
}
