import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { AppHeader } from '@/components/app-header'
import { getMe } from '@/server/auth/functions'

// Layout de las rutas que exigen sesión. Esto solo decide qué página mostrar:
// la barrera real de seguridad está en cada server function (requireUser).
export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ location }) => {
    try {
      return { user: await getMe() }
    } catch (error) {
      if (error instanceof Response && error.status === 401) {
        // Se recuerda la página pedida para volver a ella después de entrar.
        throw redirect({ to: '/login', search: { redirect: location.href } })
      }
      throw error
    }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  const { user } = Route.useRouteContext()
  return (
    <>
      <AppHeader user={user} />
      <Outlet />
    </>
  )
}
