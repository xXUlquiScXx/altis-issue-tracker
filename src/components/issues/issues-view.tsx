import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrgUsers } from '@/hooks/use-org-users'
import { api, isApiError } from '@/lib/api'
import {
  hasActiveFilters,
  toListInput,
  type IssueSearch,
} from '@/lib/issue-filters'
import { apiErrorMessage } from '@/lib/messages'
import { queryKeys } from '@/lib/query-keys'
import type { IssueDto, SessionUser } from '@/lib/types'
import { can } from '@/server/authz'
import { listIssues } from '@/server/issues/functions'
import { DeleteIssueDialog } from './delete-issue-dialog'
import { IssueFilters } from './issue-filters'
import { IssueFormDialog } from './issue-form-dialog'
import { IssueTable } from './issue-table'
import { Pagination } from './pagination'

interface Props {
  user: SessionUser
  filters: IssueSearch
  // Cambia los filtros (en la app real, los escribe en la URL).
  onFiltersChange: (patch: Partial<IssueSearch>) => void
  // Dirección de la página de detalle de un issue (para el enlace del título).
  issueHref: (issue: IssueDto) => string
  // Abre el detalle dentro de la app.
  onViewIssue: (issue: IssueDto) => void
}

const NO_FILTERS: Partial<IssueSearch> = {
  status: undefined,
  priority: undefined,
  assignee: undefined,
  q: undefined,
  page: undefined,
}

export function IssuesView({
  user,
  filters,
  onFiltersChange,
  issueHref,
  onViewIssue,
}: Props) {
  const input = toListInput(filters)
  const { data, isPending, isError, error, refetch, isPlaceholderData } =
    useQuery({
      queryKey: queryKeys.issues.list(input),
      queryFn: () => api(() => listIssues({ data: input })),
      // Al cambiar de filtro o página se sigue mostrando lo anterior, atenuado.
      placeholderData: keepPreviousData,
    })
  const { data: users } = useOrgUsers()

  const [form, setForm] = useState<{ open: boolean; issue?: IssueDto }>({
    open: false,
  })
  const [issueToDelete, setIssueToDelete] = useState<IssueDto | null>(null)
  // Al cambiar esta clave, los filtros se vuelven a montar con el buscador vacío.
  const [resetKey, setResetKey] = useState(0)

  const clearFilters = useCallback(() => {
    setResetKey((key) => key + 1)
    onFiltersChange(NO_FILTERS)
  }, [onFiltersChange])

  // La página 1 no se escribe en la URL (es la de por defecto).
  const changePage = (page: number) =>
    onFiltersChange({ page: page > 1 ? page : undefined })

  // Un member solo crea issues para sí mismo, y eso `can` lo permite.
  const canCreate = can(user, 'issue:create', {
    orgId: user.orgId,
    assigneeId: user.id,
  })

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Issues</h1>
        {canCreate && (
          <Button onClick={() => setForm({ open: true })}>
            <Plus />
            Nuevo issue
          </Button>
        )}
      </div>

      <IssueFilters
        key={resetKey}
        filters={filters}
        users={users}
        onChange={onFiltersChange}
        onClear={clearFilters}
      />

      {isPending ? (
        <ListSkeleton />
      ) : isError && !data ? (
        <div
          role="alert"
          className="space-y-3 rounded-lg border border-destructive/40 p-6 text-center"
        >
          <p className="font-medium">No se pudo cargar la lista</p>
          <p className="text-sm text-muted-foreground">
            {isApiError(error)
              ? apiErrorMessage(error)
              : apiErrorMessage({ code: 'INTERNAL', message: '' })}
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : data && data.items.length === 0 ? (
        <EmptyState
          filtered={hasActiveFilters(filters)}
          pastLastPage={(filters.page ?? 1) > 1}
          onClear={clearFilters}
          onFirstPage={() => onFiltersChange({ page: undefined })}
        />
      ) : data ? (
        <div
          className={isPlaceholderData ? 'opacity-60 transition-opacity' : ''}
          aria-busy={isPlaceholderData}
        >
          <div className="space-y-3">
            {/* Dos barras: así no hay que bajar hasta el final para cambiar de página. */}
            <Pagination
              label="Paginación superior"
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={changePage}
            />
            <IssueTable
              issues={data.items}
              user={user}
              issueHref={issueHref}
              onView={onViewIssue}
              onEdit={(issue) => setForm({ open: true, issue })}
              onDelete={setIssueToDelete}
            />
            <Pagination
              label="Paginación inferior"
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={changePage}
            />
          </div>
        </div>
      ) : null}

      <IssueFormDialog
        // Otra key por issue: el formulario siempre arranca con sus datos.
        key={form.issue?.id ?? 'new'}
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        user={user}
        issue={form.issue}
      />
      <DeleteIssueDialog
        issue={issueToDelete}
        onClose={() => setIssueToDelete(null)}
      />
    </section>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-2" aria-busy aria-label="Cargando issues">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  )
}

function EmptyState({
  filtered,
  pastLastPage,
  onClear,
  onFirstPage,
}: {
  filtered: boolean
  pastLastPage: boolean
  onClear: () => void
  onFirstPage: () => void
}) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed p-8 text-center">
      {pastLastPage ? (
        <>
          <p className="font-medium">Esta página ya no tiene issues</p>
          <Button variant="outline" onClick={onFirstPage}>
            Volver a la primera página
          </Button>
        </>
      ) : filtered ? (
        <>
          <p className="font-medium">Ningún issue coincide con los filtros</p>
          <Button variant="outline" onClick={onClear}>
            Limpiar filtros
          </Button>
        </>
      ) : (
        <>
          <p className="font-medium">Todavía no hay issues</p>
          <p className="text-sm text-muted-foreground">
            Crea el primero con el botón «Nuevo issue».
          </p>
        </>
      )}
    </div>
  )
}
