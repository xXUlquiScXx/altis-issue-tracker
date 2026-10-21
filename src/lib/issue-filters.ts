import { z } from 'zod'
import { PRIORITIES, STATUSES } from './types'

export const PAGE_SIZE = 20

// Filtros de la lista tal como viajan en la URL (?status=done&page=2).
// `.catch(undefined)`: si alguien escribe un valor inválido a mano, se ignora
// en vez de romper la página.
export const issueSearchSchema = z.object({
  page: z.number().int().min(1).optional().catch(undefined),
  status: z.enum(STATUSES).optional().catch(undefined),
  priority: z.enum(PRIORITIES).optional().catch(undefined),
  assignee: z
    .union([z.uuid(), z.literal('unassigned')])
    .optional()
    .catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
})

export type IssueSearch = z.infer<typeof issueSearchSchema>

// Lo que se le pide al servidor a partir de los filtros de la URL.
export function toListInput(filters: IssueSearch) {
  return {
    page: filters.page ?? 1,
    pageSize: PAGE_SIZE,
    status: filters.status,
    priority: filters.priority,
    assignee: filters.assignee,
    q: filters.q || undefined,
  }
}

export function hasActiveFilters(filters: IssueSearch) {
  return Boolean(
    filters.status || filters.priority || filters.assignee || filters.q,
  )
}
