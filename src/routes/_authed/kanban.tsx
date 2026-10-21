import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { boardSearchSchema, type BoardSearch } from '@/lib/issue-filters'
import type { IssueDto } from '@/lib/types'

export const Route = createFileRoute('/_authed/kanban')({
  // Los filtros del tablero viven en la URL, igual que en la lista.
  validateSearch: (search: Record<string, unknown>) =>
    boardSearchSchema.parse(search),
  component: KanbanPage,
})

function KanbanPage() {
  const { user } = Route.useRouteContext()
  const filters = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()

  const handleFiltersChange = useCallback(
    (patch: Partial<BoardSearch>) => {
      void navigate({
        search: (prev) => ({ ...prev, ...patch }),
        replace: true,
      })
    },
    [navigate],
  )

  // El detalle es una página con su propia URL (se puede compartir).
  const issueHref = (issue: IssueDto) =>
    router.buildLocation({ to: '/issues/$id', params: { id: issue.id } }).href
  const openIssue = (issue: IssueDto) =>
    void navigate({ to: '/issues/$id', params: { id: issue.id } })

  return (
    <main id="contenido" className="mx-auto max-w-6xl p-4">
      <KanbanBoard
        user={user}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        issueHref={issueHref}
        onViewIssue={openIssue}
      />
    </main>
  )
}
