// @vitest-environment node
import { SignJWT } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerSchema } from '@/lib/schemas'
import { AppError } from '@/server/errors'
import { hashPassword, verifyPassword } from '@/server/auth/password'
import { checkRateLimit, resetRateLimits } from '@/server/auth/rate-limit'
import {
  SESSION_MAX_AGE_SECONDS,
  signSession,
  verifySession,
} from '@/server/auth/session'

const SECRET = 'a'.repeat(48)
const payload = { userId: 'user-1', orgId: 'org-1', role: 'member' } as const

beforeEach(() => {
  process.env.JWT_SECRET = SECRET
  resetRateLimits()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('Password123!')
    expect(hash).not.toContain('Password123!')
    expect(await verifyPassword('Password123!', hash)).toBe(true)
    expect(await verifyPassword('otra-clave', hash)).toBe(false)
  })
})

describe('session token', () => {
  it('round-trips the payload', async () => {
    const token = await signSession(payload)
    expect(await verifySession(token)).toEqual(payload)
  })

  it('rejects a tampered token', async () => {
    const token = await signSession(payload)
    expect(await verifySession(token.slice(0, -2) + 'xx')).toBeNull()
  })

  it('rejects a token signed with another secret', async () => {
    const forged = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('b'.repeat(48)))
    expect(await verifySession(forged)).toBeNull()
  })

  it('rejects an expired token', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const token = await signSession(payload)
    vi.setSystemTime(Date.now() + (SESSION_MAX_AGE_SECONDS + 1) * 1000)
    expect(await verifySession(token)).toBeNull()
  })

  it('refuses to work without a strong JWT_SECRET', async () => {
    process.env.JWT_SECRET = 'corto'
    await expect(signSession(payload)).rejects.toThrow('JWT_SECRET')
  })
})

describe('rate limit', () => {
  const limit = { max: 3, windowMs: 1000 }

  it('blocks after the allowed attempts and lets the key through later', () => {
    for (let i = 0; i < 3; i++) checkRateLimit('k', limit, 0)
    expect(() => checkRateLimit('k', limit, 10)).toThrow(AppError)
    expect(() => checkRateLimit('k', limit, 1001)).not.toThrow()
  })

  it('counts each key separately', () => {
    for (let i = 0; i < 3; i++) checkRateLimit('a', limit, 0)
    expect(() => checkRateLimit('b', limit, 0)).not.toThrow()
  })

  it('throws RATE_LIMITED', () => {
    for (let i = 0; i < 3; i++) checkRateLimit('k', limit, 0)
    try {
      checkRateLimit('k', limit, 1)
      expect.unreachable()
    } catch (error) {
      expect((error as AppError).code).toBe('RATE_LIMITED')
    }
  })
})

describe('register schema', () => {
  it('drops role and orgId sent by the client and normalizes the input', () => {
    const parsed = registerSchema.parse({
      name: '  Ana  ',
      email: '  ANA@Acme.TEST ',
      password: 'Secret123',
      role: 'admin',
      orgId: 'otra-org',
    })
    expect(parsed).toEqual({
      name: 'Ana',
      email: 'ana@acme.test',
      password: 'Secret123',
    })
  })

  it('rejects short passwords and invalid emails', () => {
    const result = registerSchema.safeParse({
      name: 'Ana',
      email: 'no-es-correo',
      password: '123',
    })
    expect(result.success).toBe(false)
  })
})
