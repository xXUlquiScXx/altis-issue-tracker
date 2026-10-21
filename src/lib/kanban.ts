import type { BoardSearch } from './issue-filters'
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

// Reparte los issues en sus columnas. Dentro de cada una, el más reciente primero
// (igual que el servidor, así una tarjeta recién movida queda arriba).
export function groupByStatus(issues: IssueDto[]) {
  const columns: Record<Status, IssueDto[]> = {
    todo: [],
    in_progress: [],
    done: [],
  }
  for (const issue of issues) columns[issue.status].push(issue)
  for (const status of STATUSES) {
    columns[status].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    )
  }
  return columns
}

// Al soltar una tarjeta, ¿a qué estado hay que pasarla? Devuelve null si se soltó
// fuera de una columna o en la misma donde ya estaba (no hay nada que cambiar).
export function statusFromDrop(
  overId: unknown,
  currentStatus: Status | undefined,
): Status | null {
  const target = STATUSES.find((status) => status === overId)
  if (!target || target === currentStatus) return null
  return target
}
