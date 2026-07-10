import { api } from "./client"
import type { BalanceSummary } from "@/types"

export const balancesApi = {
  get: (groupId: string) =>
    api.get<BalanceSummary>(`/groups/${groupId}/balances`),
}
