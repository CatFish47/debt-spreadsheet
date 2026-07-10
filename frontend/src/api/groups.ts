import { api } from "./client"
import type { Group } from "@/types"

export const groupsApi = {
  list: () => api.get<Group[]>("/groups"),
  get: (id: string) => api.get<Group>(`/groups/${id}`),
  create: (name: string, currency = "USD") =>
    api.post<Group>("/groups", { name, currency }),
  joinByCode: (code: string) =>
    api.post<Group>(`/groups/join/${encodeURIComponent(code)}`),
  leave: (id: string) => api.delete<void>(`/groups/${id}/members/me`),
}
