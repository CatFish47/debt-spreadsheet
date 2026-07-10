import { useState } from "react"
import { Copy, Check, Link } from "lucide-react"
import type { Group } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Props {
  group: Group
}

export function GroupJoinCard({ group }: Props) {
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const joinUrl = `${window.location.origin}/join/${group.join_code}`

  async function copyCode() {
    await navigator.clipboard.writeText(group.join_code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(joinUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground font-normal">Invite others</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <p className="text-lg font-mono font-bold tracking-widest">{group.join_code}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={copyCode}>
            {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiedCode ? "Copied!" : "Copy code"}
          </Button>
          <Button size="sm" variant="outline" onClick={copyLink}>
            {copiedLink ? <Check className="h-4 w-4" /> : <Link className="h-4 w-4" />}
            {copiedLink ? "Copied!" : "Copy link"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
