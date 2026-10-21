import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getMe } from '@/server/auth/functions'

// Layout de las rutas que exigen sesión. Esto solo decide qué página mostrar:
// la barrera real de seguridad está en cada server function (requireUser).
export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    try {
      return { user: await getMe() }
    } catch (error) {
      if (error instanceof Response && error.status === 401) {
        throw redirect({ to: '/login' })
      }
      throw error
    }
  },
  component: Outlet,
})
