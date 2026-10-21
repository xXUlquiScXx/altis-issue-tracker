import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { IssueFilters } from '@/components/issues/issue-filters'
import { IssueFormDialog } from '@/components/issues/issue-form-dialog'
import { RefreshButton } from '@/components/refresh-button'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMoveIssue } from '@/hooks/use-move-issue'
import { useOrgUsers } from '@/hooks/use-org-users'
import { api, isApiError } from '@/lib/api'
import type { BoardSearch, IssueSearch } from '@/lib/issue-filters'
import {
  BOARD_PAGE_SIZE,
  dropTarget,
  groupByStatus,
  isBelowMiddle,
  toBoardInput,
  type DropTarget,
} from '@/lib/kanban'
import { STATUS_LABEL } from '@/lib/labels'
import { apiErrorMessage } from '@/lib/messages'
import { queryKeys } from '@/lib/query-keys'
import { STATUSES, type IssueDto, type SessionUser } from '@/lib/types'
import { can } from '@/server/authz'
import { listIssues } from '@/server/issues/functions'
import { KanbanCard, KanbanCardPreview } from './kanban-card'
import { KanbanColumn } from './kanban-column'

interface Props {
  user: SessionUser
  filters: BoardSearch
  onFiltersChange: (patch: Partial<BoardSearch>) => void
  issueHref: (issue: IssueDto) => string
  onViewIssue: (issue: IssueDto) => void
}

// Qué hay bajo el puntero: primero una tarjeta (para colocar entre tarjetas); si
// no hay, la columna. Si el puntero no está sobre nada, la que más se solape.
const collisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args)
  const cards = pointer.filter(
    (collision) => !STATUSES.some((status) => status === collision.id),
  )
  if (cards.length > 0) return cards
  return pointer.length > 0 ? pointer : rectIntersection(args)
}

function sameTarget(a: DropTarget | null, b: DropTarget | null) {
  return a?.status === b?.status && a?.afterId === b?.afterId
}

export function KanbanBoard({
  user,
  filters,
  onFiltersChange,
  issueHref,
  onViewIssue,
}: Props) {
  const input = toBoardInput(filters)
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.issues.board(input),
    queryFn: () => api(() => listIssues({ data: input })),
    placeholderData: keepPreviousData,
  })
  const { data: users } = useOrgUsers()
  const move = useMoveIssue(input)
  const [activeId, setActiveId] = useState<string | null>(null)
  // Dónde caería la tarjeta que se está arrastrando (para dibujar la línea).
  const [hint, setHint] = useState<DropTarget | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [creating, setCreating] = useState(false)

  // Mouse, dedo y teclado. Se separan mouse y dedo (en vez de un solo "pointer")
  // para que en el celular un deslizamiento normal siga haciendo scroll.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  )

  const issues = data?.items ?? []
  const columns = groupByStatus(issues)
  const activeIssue = issues.find((issue) => issue.id === activeId)

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  // Dónde caería la tarjeta con lo que hay bajo el puntero en este momento.
  function targetOf(event: DragMoveEvent | DragEndEvent) {
    const { active, over } = event
    if (!over) return null
    const moved = active.rect.current.translated
    // Mitad de arriba o de abajo de la tarjeta sobre la que pasa: encima o debajo.
    const below = moved ? isBelowMiddle(moved, over.rect) : true
    return dropTarget(over.id, String(active.id), columns, below)
  }

  function handleDragMove(event: DragMoveEvent) {
    const next = targetOf(event)
    setHint((current) => (sameTarget(current, next) ? current : next))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    setHint(null)
    const issue = issues.find((item) => item.id === event.active.id)
    const target = targetOf(event)
    if (issue && target) move.mutate({ issue, ...target })
  }

  // Los filtros compartidos hablan de "página" y "estado", que aquí no existen:
  // se pasa solo lo que cambió (si no, se borrarían los demás filtros).
  const handleFilters = useCallback(
    (patch: Partial<IssueSearch>) => {
      const boardPatch: Partial<BoardSearch> = {}
      if ('priority' in patch) boardPatch.priority = patch.priority
      if ('assignee' in patch) boardPatch.assignee = patch.assignee
      if ('q' in patch) boardPatch.q = patch.q
      onFiltersChange(boardPatch)
    },
    [onFiltersChange],
  )

  const clearFilters = () => {
    setResetKey((key) => key + 1)
    onFiltersChange({ priority: undefined, assignee: undefined, q: undefined })
  }

  const hasFilters = Boolean(filters.priority || filters.assignee || filters.q)
  const canCreate = can(user, 'issue:create', {
    orgId: user.orgId,
    assigneeId: user.id,
  })

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Kanban</h1>
        <div className="flex items-center gap-2">
          <RefreshButton
            label="Actualizar tablero"
            isFetching={isFetching}
            onRefresh={() => void refetch()}
          />
          {/* Mismas reglas que en la lista: el member solo crea issues para sí mismo. */}
          {canCreate && (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              Nuevo issue
            </Button>
          )}
        </div>
      </div>

      <IssueFilters
        key={resetKey}
        hideStatus
        filters={{ ...filters, page: undefined, status: undefined }}
        users={users}
        onChange={handleFilters}
        onClear={clearFilters}
      />

      {data && data.total > BOARD_PAGE_SIZE && (
        <p role="status" className="text-sm text-muted-foreground">
          Se muestran los {BOARD_PAGE_SIZE} issues más recientes de {data.total}
          . Usa los filtros para acotar.
        </p>
      )}

      {isPending ? (
        <BoardSkeleton />
      ) : isError && !data ? (
        <div
          role="alert"
          className="space-y-3 rounded-lg border border-destructive/40 p-6 text-center"
        >
          <p className="font-medium">No se pudo cargar el tablero</p>
          <p className="text-sm text-muted-foreground">
            {isApiError(error)
              ? apiErrorMessage(error)
              : apiErrorMessage({ code: 'INTERNAL', message: '' })}
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          {hasFilters && issues.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ningún issue coincide con los filtros.
            </p>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onDragCancel={() => {
              setActiveId(null)
              setHint(null)
            }}
            accessibility={{
              screenReaderInstructions: {
                draggable:
                  'Para mover la tarjeta, presiona Espacio y usa las flechas hasta la columna que quieras; presiona Espacio otra vez para soltar o Escape para cancelar. También puedes usar el selector «Mover a» de la tarjeta.',
              },
              announcements: {
                onDragStart: ({ active }) =>
                  `Agarraste «${issues.find((i) => i.id === active.id)?.title}».`,
                onDragOver: ({ over }) =>
                  over ? `Sobre la columna «${labelOf(over.id)}».` : undefined,
                onDragEnd: ({ over }) =>
                  over
                    ? `Soltaste en la columna «${labelOf(over.id)}».`
                    : 'Soltaste fuera de una columna.',
                onDragCancel: () => 'Movimiento cancelado.',
              },
            }}
          >
            <div
              className={
                // En celular las columnas se deslizan de lado; desde `sm` van lado a lado.
                'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:snap-none sm:overflow-visible'
              }
            >
              {STATUSES.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  count={columns[status].length}
                  lineOnTop={hint?.status === status && hint.afterId === null}
                >
                  {columns[status].map((issue) => (
                    <KanbanCard
                      key={issue.id}
                      issue={issue}
                      href={issueHref(issue)}
                      // La UI solo oculta el arrastre; el servidor vuelve a comprobar todo.
                      canMove={can(user, 'issue:update', {
                        orgId: user.orgId,
                        assigneeId: issue.assigneeId,
                      })}
                      lineBelow={hint?.afterId === issue.id}
                      onView={onViewIssue}
                      onMove={(next) => {
                        // Elegir el estado en el que ya está no cambia nada.
                        if (next !== issue.status) {
                          move.mutate({ issue, status: next, afterId: null })
                        }
                      }}
                    />
                  ))}
                </KanbanColumn>
              ))}
            </div>
            <DragOverlay>
              {activeIssue ? <KanbanCardPreview issue={activeIssue} /> : null}
            </DragOverlay>
          </DndContext>
        </>
      )}

      {/* El formulario de siempre; al crear, se refresca el tablero (issues.all). */}
      <IssueFormDialog open={creating} onOpenChange={setCreating} user={user} />
    </section>
  )
}

function labelOf(id: unknown) {
  return STATUSES.find((status) => status === id)
    ? STATUS_LABEL[id as (typeof STATUSES)[number]]
    : String(id)
}

function BoardSkeleton() {
  return (
    <div className="flex gap-3" aria-busy aria-label="Cargando tablero">
      {STATUSES.map((status) => (
        <div
          key={status}
          className="flex-1 space-y-2 rounded-xl bg-muted/40 p-2"
        >
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ))}
    </div>
  )
}
