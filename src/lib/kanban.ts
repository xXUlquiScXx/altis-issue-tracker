import type { BoardSearch } from './issue-filters'
import { nextPositionAfter, slotBetween } from './position'
import { STATUSES, type IssueDto, type Status } from './types'

// El servidor entrega como máximo 100 issues por consulta. El tablero pide esa
// cantidad de una sola vez (una consulta, no una por columna) y avisa si hay más.
export const BOARD_PAGE_SIZE = 100

// Lo que se le pide al servidor a partir de los filtros del tablero.
export function toBoardInput(filters: BoardSearch) {
  return {
    page: 1,
    pageSize: BOARD_PAGE_SIZE,
    priority: filters.priority,
    assignee: filters.assignee,
    q: filters.q || undefined,
  }
}

// Orden dentro de una columna: por `position` (menor = más arriba). Si dos tienen
// la misma (por ejemplo, dos personas la movieron a la vez), la más reciente primero
// y, al final, el id, para que el orden sea siempre el mismo.
export function byPosition(a: IssueDto, b: IssueDto) {
  return (
    a.position - b.position ||
    b.updatedAt.getTime() - a.updatedAt.getTime() ||
    a.id.localeCompare(b.id)
  )
}

// Reparte los issues en sus columnas, cada una en su orden manual.
export function groupByStatus(issues: IssueDto[]) {
  const columns: Record<Status, IssueDto[]> = {
    todo: [],
    in_progress: [],
    done: [],
  }
  for (const issue of issues) columns[issue.status].push(issue)
  for (const status of STATUSES) columns[status].sort(byPosition)
  return columns
}

// Dónde queda una tarjeta: en qué columna y debajo de qué tarjeta (null = al principio).
export interface DropTarget {
  status: Status
  afterId: string | null
}

// ¿El centro de la tarjeta arrastrada está en la mitad de abajo de la tarjeta sobre
// la que pasa? Si sí, va debajo de ella; si no, encima.
export function isBelowMiddle(
  active: { top: number; height: number },
  over: { top: number; height: number },
) {
  return active.top + active.height / 2 > over.top + over.height / 2
}

// A dónde hay que mover la tarjeta `activeId` al soltarla sobre `overId`, que puede
// ser otra tarjeta o una columna. Devuelve null si no hay nada que hacer: se soltó
// fuera de todo, sobre sí misma, o en el mismo lugar donde ya estaba.
export function dropTarget(
  overId: unknown,
  activeId: string,
  columns: Record<Status, IssueDto[]>,
  below: boolean,
): DropTarget | null {
  const active = STATUSES.flatMap((status) => columns[status]).find(
    (issue) => issue.id === activeId,
  )
  if (!active || overId === activeId) return null

  // Sin la tarjeta arrastrada: lo que importa son sus futuras vecinas.
  const without = (status: Status) =>
    columns[status].filter((issue) => issue.id !== activeId)

  let target: DropTarget
  const overColumn = STATUSES.find((status) => status === overId)
  if (overColumn) {
    // Soltada sobre el fondo de una columna: va al final.
    target = {
      status: overColumn,
      afterId: without(overColumn).at(-1)?.id ?? null,
    }
  } else {
    const over = STATUSES.flatMap((status) => columns[status]).find(
      (issue) => issue.id === overId,
    )
    if (!over) return null
    const neighbours = without(over.status)
    const index = neighbours.findIndex((issue) => issue.id === over.id)
    target = {
      status: over.status,
      afterId: below ? over.id : (neighbours[index - 1]?.id ?? null),
    }
  }

  // Misma columna y misma vecina de arriba que antes: no se movió.
  if (target.status === active.status) {
    const currentIndex = columns[active.status].findIndex(
      (i) => i.id === activeId,
    )
    const currentAfter = columns[active.status][currentIndex - 1]?.id ?? null
    if (target.afterId === currentAfter) return null
  }
  return target
}

// La posición que tendrá la tarjeta `active` al soltarla en `status`, debajo de
// `afterId` (null = al principio). Es la misma cuenta que hace el servidor, para
// que la tarjeta aparezca ya en su lugar mientras llega la respuesta.
export function positionForDrop(
  items: IssueDto[],
  active: IssueDto,
  status: Status,
  afterId: string | null,
) {
  const column = items.filter(
    (issue) => issue.status === status && issue.id !== active.id,
  )
  const positions = column.map((issue) => issue.position)
  const after = afterId ? column.find((i) => i.id === afterId) : undefined
  if (!after) {
    return slotBetween(null, positions.length ? Math.min(...positions) : null)
  }
  return slotBetween(
    after.position,
    nextPositionAfter(positions, after.position),
  )
}
