import type { } from '#auth-utils'

export interface AdminIdentity {
  id: number
  username: string
  role: 'admin'
}
export interface AdminSession {
  user: AdminIdentity
  expiresAt: number
}
declare module '#auth-utils' {
  interface User extends AdminIdentity { }
  interface UserSession { expiresAt?: number }
}
