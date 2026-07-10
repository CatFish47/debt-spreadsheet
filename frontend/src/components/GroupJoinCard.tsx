import { useState } from "react"
import { Copy, Check } from "lucide-react"
import type { Group } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Props {
  group: Group
}

export function GroupJoinCard({ group }: Props) {
  const [copied, setCopied] = useState(false)

  const joinUrl = `${window.location.origin}/join/${group.join_code}`

  async function copy() {
    await navigator.clipboard.writeText(joinUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground font-normal">Invite others</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-mono font-bold tracking-widest">{group.join_code}</p>
          <p className="text-xs text-muted-foreground">Share this code or the link below</p>
        </div>
        <Button size="sm" variant="outline" onClick={copy} className="shrink-0">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied!" : "Copy link"}
        </Button>
      </CardContent>
    </Card>
  )
}
