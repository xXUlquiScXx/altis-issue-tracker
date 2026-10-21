import { parseApiError } from './api-error'
import { ERROR_STATUS, type ErrorCode } from './errors'

// Error que ve el resto de la UI: ya trae el código de la API (FORBIDDEN, etc.).
export class ApiRequestError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message)
  }

  get status() {
    return ERROR_STATUS[this.code]
  }
}

export function isApiError(
  error: unknown,
  code?: ErrorCode,
): error is ApiRequestError {
  return (
    error instanceof ApiRequestError &&
    (code === undefined || error.code === code)
  )
}

// Envuelve la llamada a una server function. Si falla, las server functions
// rechazan con una Response; aquí se convierte en un ApiRequestError.
//   const page = await api(() => listIssues({ data: filters }))
export async function api<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    const { code, message, fields } = await parseApiError(error)
    throw new ApiRequestError(code, message, fields)
  }
}
