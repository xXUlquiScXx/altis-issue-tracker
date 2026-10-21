import { z } from 'zod'
import { ERROR_STATUS, type ApiError, type ErrorCode } from '@/lib/errors'
import { fieldErrorsFrom } from '@/lib/forms'

// Error "esperado" que el servidor lanza a propósito (permiso, validación...).
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message)
  }
}

function toApiError(error: unknown): ApiError {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message, fields: error.fields }
  }
  if (error instanceof z.ZodError) {
    return {
      code: 'VALIDATION',
      message: 'Invalid input',
      fields: fieldErrorsFrom(error),
    }
  }
  // Cualquier otra cosa es un fallo inesperado: el detalle solo va al log.
  console.error('Unhandled server error', error)
  return { code: 'INTERNAL', message: 'Internal server error' }
}

// Convierte cualquier error en una Response JSON con el status correcto.
export function toErrorResponse(error: unknown): Response {
  const apiError = toApiError(error)
  return Response.json(
    { error: apiError },
    { status: ERROR_STATUS[apiError.code] },
  )
}
