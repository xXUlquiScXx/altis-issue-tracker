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
      {/* Invisible hasta que se enfoca con el teclado (Tab): permite saltarse el menú. */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-md focus:ring-3 focus:ring-ring/50"
      >
        Saltar al contenido
      </a>
      <AppHeader user={user} />
      <Outlet />
    </>
  )
}
