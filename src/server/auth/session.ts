import { SignJWT, jwtVerify } from 'jose'
import type { Role } from '@/lib/types'

export const SESSION_MAX_AGE_SECONDS = 2 * 60 * 60

export interface SessionPayload {
  userId: string
  orgId: string
  role: Role
}

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and have at least 32 characters')
  }
  return new TextEncoder().encode(secret)
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret())
}

// Devuelve null si el token está alterado, vencido o mal formado.
export async function verifySession(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ['HS256'],
    })
    const { userId, orgId, role } = payload
    if (
      typeof userId !== 'string' ||
      typeof orgId !== 'string' ||
      (role !== 'admin' && role !== 'member')
    ) {
      return null
    }
    return { userId, orgId, role }
  } catch {
    return null
  }
}
