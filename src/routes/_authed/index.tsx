import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { logout } from '@/server/auth/functions'

export const Route = createFileRoute('/_authed/')({
  component: Home,
})

// Pantalla provisional: la lista de issues llega en la fase 9.
function Home() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function onLogout() {
    setPending(true)
    try {
      await logout()
      await router.invalidate()
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">Hola, {user.name}</h1>
      <p className="text-muted-foreground">
        {user.orgName} · {user.role === 'admin' ? 'Administrador' : 'Miembro'}
      </p>
      <Button onClick={onLogout} disabled={pending} variant="outline">
        Cerrar sesión
      </Button>
    </main>
  )
}
