import { createServerFn } from '@tanstack/react-start'
import { getRequestIP } from '@tanstack/react-start/server'
import { loginSchema, registerSchema } from '@/lib/schemas'
import { errorMiddleware, requireUser } from '../middleware'
import { validate } from '../validate'
import { clearSessionCookie, setSessionCookie } from './cookie'
import { checkRateLimit } from './rate-limit'
import { loginUser, registerUser } from './service'
import { signSession } from './session'

// Límite por IP + email, para frenar fuerza bruta sin bloquear a toda una oficina.
function rateLimitKey(action: string, email: string) {
  const ip = getRequestIP({ xForwardedFor: true }) ?? 'unknown'
  return `${action}:${ip}:${email}`
}

export const register = createServerFn({ method: 'POST' })
  .middleware([errorMiddleware])
  .validator(validate(registerSchema))
  .handler(async ({ data }) => {
    checkRateLimit(rateLimitKey('register', data.email))
    const user = await registerUser(data)
    setSessionCookie(
      await signSession({
        userId: user.id,
        orgId: user.orgId,
        role: user.role,
      }),
    )
    return user
  })

export const login = createServerFn({ method: 'POST' })
  .middleware([errorMiddleware])
  .validator(validate(loginSchema))
  .handler(async ({ data }) => {
    checkRateLimit(rateLimitKey('login', data.email))
    const user = await loginUser(data)
    setSessionCookie(
      await signSession({
        userId: user.id,
        orgId: user.orgId,
        role: user.role,
      }),
    )
    return user
  })

export const logout = createServerFn({ method: 'POST' })
  .middleware([errorMiddleware])
  .handler(() => {
    clearSessionCookie()
    return { ok: true }
  })

// Devuelve el usuario de la sesión, o responde UNAUTHENTICATED (401).
export const getMe = createServerFn()
  .middleware([requireUser])
  .handler(({ context }) => context.user)
