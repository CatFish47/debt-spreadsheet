import { api } from "./client"
import type { User } from "@/types"

export const authApi = {
  login: (key: string) => api.get<User>(`/auth/login?key=${encodeURIComponent(key)}`),
  logout: () => api.post<void>("/auth/logout"),
  me: () => api.get<User>("/auth/me"),
}
