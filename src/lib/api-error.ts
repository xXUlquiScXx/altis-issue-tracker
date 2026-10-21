import { isErrorCode, type ApiError } from './errors'

const UNEXPECTED: ApiError = {
  code: 'INTERNAL',
  message: 'Internal server error',
}

// Las server functions rechazan con una Response cuyo JSON es { error: ApiError }.
export async function parseApiError(error: unknown): Promise<ApiError> {
  if (!(error instanceof Response)) return UNEXPECTED
  try {
    const body = (await error.clone().json()) as { error?: ApiError }
    if (body.error && isErrorCode(body.error.code)) return body.error
  } catch {
    // El cuerpo no era JSON: se trata como error inesperado.
  }
  return UNEXPECTED
}
