import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/')({
  component: IssuesPage,
})

// Pantalla provisional: la lista de issues llega en la entrega 2 de la fase 9.
function IssuesPage() {
  const { user } = Route.useRouteContext()
  return (
    <main className="mx-auto max-w-6xl space-y-2 p-4">
      <h1 className="text-2xl font-bold">Hola, {user.name}</h1>
      <p className="text-muted-foreground">
        La lista de issues llega en la siguiente entrega.
      </p>
    </main>
  )
}
