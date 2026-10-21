export type Role = 'admin' | 'member'

// Usuario autenticado tal como lo conoce el servidor (y lo recibe la UI).
export interface SessionUser {
  id: string
  orgId: string
  orgName: string
  role: Role
  name: string
  email: string
}
