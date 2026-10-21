// Códigos de error compartidos entre servidor y cliente.
export const ERROR_STATUS = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const

export type ErrorCode = keyof typeof ERROR_STATUS

// Forma del JSON que devuelve la API cuando algo falla.
export interface ApiError {
  code: ErrorCode
  message: string
  fields?: Record<string, string>
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && value in ERROR_STATUS
}
