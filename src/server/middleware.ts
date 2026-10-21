import { isNotFound, isRedirect } from '@tanstack/react-router'
import { createMiddleware } from '@tanstack/react-start'
import { getSessionUser } from './auth/current-user'
import { AppError, toErrorResponse } from './errors'

// Atrapa cualquier error y lo convierte en una Response JSON con código y status.
export const errorMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    try {
      return await next()
    } catch (error) {
      // Las respuestas, redirecciones y not-found del framework pasan tal cual.
      if (error instanceof Response || isRedirect(error) || isNotFound(error)) {
        throw error
      }
      throw toErrorResponse(error)
    }
  },
)

// Exige sesión válida y deja al usuario en `context.user`.
export const requireUser = createMiddleware({ type: 'function' })
  .middleware([errorMiddleware])
  .server(async ({ next }) => {
    const user = await getSessionUser()
    if (!user) throw new AppError('UNAUTHENTICATED', 'Authentication required')
    return next({ context: { user } })
  })
