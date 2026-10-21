import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import { IssuesView } from '@/components/issues/issues-view'
import { issueSearchSchema, type IssueSearch } from '@/lib/issue-filters'

export const Route = createFileRoute('/_authed/')({
  // Los filtros y la página viven en la URL: se pueden compartir y recargar.
  validateSearch: (search: Record<string, unknown>) =>
    issueSearchSchema.parse(search),
  component: IssuesPage,
})

function IssuesPage() {
  const { user } = Route.useRouteContext()
  const filters = Route.useSearch()
  const navigate = Route.useNavigate()

  const handleFiltersChange = useCallback(
    (patch: Partial<IssueSearch>) => {
      // `replace`: cambiar un filtro no llena el historial del navegador.
      void navigate({
        search: (prev) => ({ ...prev, ...patch }),
        replace: true,
      })
    },
    [navigate],
  )

  return (
    <main className="mx-auto max-w-6xl p-4">
      <IssuesView
        user={user}
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />
    </main>
  )
}
