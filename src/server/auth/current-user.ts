import type { SessionUser } from '@/lib/types'
import { readSessionCookie } from './cookie'
import { findSessionUser } from './service'
import { verifySession } from './session'

// Resuelve el usuario de la petición actual a partir de la cookie.
// Devuelve null si no hay cookie, el token es inválido/venció o el usuario ya no existe.
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = readSessionCookie()
  if (!token) return null
  const payload = await verifySession(token)
  if (!payload) return null
  return findSessionUser(payload.userId)
}
