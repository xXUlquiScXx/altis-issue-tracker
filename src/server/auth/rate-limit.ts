import { AppError } from '../errors'

interface Window {
  count: number
  resetAt: number
}

// En memoria: cada instancia del servidor lleva su propia cuenta. En serverless
// (Vercel) es un límite "por instancia", no global; es un trade-off conocido.
const windows = new Map<string, Window>()

export const AUTH_LIMIT = { max: 5, windowMs: 60_000 }

// Ventana fija: se permiten `max` intentos por clave dentro de cada ventana.
export function checkRateLimit(
  key: string,
  { max, windowMs }: { max: number; windowMs: number } = AUTH_LIMIT,
  now = Date.now(),
) {
  for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k)

  const current = windows.get(key)
  if (!current) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  current.count += 1
  if (current.count > max) {
    throw new AppError('RATE_LIMITED', 'Too many attempts, try again later')
  }
}

export function resetRateLimits() {
  windows.clear()
}
