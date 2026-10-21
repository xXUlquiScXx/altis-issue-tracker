import type { ListIssuesInput } from './schemas'

// Todas las claves de caché en un solo lugar. Invalidar `issues.all` refresca
// de una vez la lista, el detalle, el historial y los comentarios.
export const queryKeys = {
  issues: {
    all: ['issues'] as const,
    // Todas las listas y todos los tableros (sea cual sea su filtro o página).
    lists: ['issues', 'list'] as const,
    boards: ['issues', 'board'] as const,
    list: (filters: Partial<ListIssuesInput>) =>
      ['issues', 'list', filters] as const,
    // El tablero tiene su propia consulta (sin paginar): todas las tarjetas de una vez.
    board: (filters: Partial<ListIssuesInput>) =>
      ['issues', 'board', filters] as const,
    detail: (id: string) => ['issues', 'detail', id] as const,
    events: (id: string) => ['issues', 'events', id] as const,
    comments: (id: string) => ['issues', 'comments', id] as const,
  },
  orgUsers: ['org-users'] as const,
}
