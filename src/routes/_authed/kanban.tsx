import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/kanban')({
  component: KanbanPage,
})

// Pantalla provisional: el tablero se construye en la fase 11.
function KanbanPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-2 p-4">
      <h1 className="text-2xl font-bold">Kanban</h1>
      <p className="text-muted-foreground">El tablero llega más adelante.</p>
    </main>
  )
}
