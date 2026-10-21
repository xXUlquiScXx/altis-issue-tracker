import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, isApiError } from '@/lib/api'
import { positionForDrop } from '@/lib/kanban'
import { STATUS_LABEL } from '@/lib/labels'
import { apiErrorMessage } from '@/lib/messages'
import type { ListIssuesInput } from '@/lib/schemas'
import { queryKeys } from '@/lib/query-keys'
import type { IssueDto, IssuePage, Status } from '@/lib/types'
import { moveIssue } from '@/server/issues/functions'

const MOVE_KEY = ['issues', 'move'] as const

interface MoveVariables {
  issue: IssueDto
  // Columna de destino (puede ser la misma en la que ya estaba).
  status: Status
  // La tarjeta que queda justo encima; null = al principio de la columna.
  afterId: string | null
}

// Mover una tarjeta (de columna y/o de lugar dentro de la columna) con
// actualización optimista: se coloca al instante, sin esperar al servidor.
//   - onMutate:  se cancelan las consultas en vuelo y se coloca la tarjeta.
//   - onError:   la tarjeta vuelve a donde estaba y se avisa por qué.
//   - onSettled: se vuelve a pedir lo del servidor, para quedar con el dato real.
export function useMoveIssue(boardInput: Partial<ListIssuesInput>) {
  const queryClient = useQueryClient()
  const boardKey = queryKeys.issues.board(boardInput)

  // Cambia una sola tarjeta dentro de lo que hay en caché.
  function replaceIssue(updated: IssueDto) {
    queryClient.setQueryData<IssuePage>(
      boardKey,
      (page) =>
        page && {
          ...page,
          items: page.items.map((item) =>
            item.id === updated.id ? updated : item,
          ),
        },
    )
  }

  return useMutation({
    mutationKey: MOVE_KEY,
    // Este aviso es más específico que el genérico: se desactiva el central.
    meta: { skipErrorToast: true },
    mutationFn: ({ issue, status, afterId }: MoveVariables) =>
      api(() => moveIssue({ data: { id: issue.id, status, afterId } })),

    onMutate: async ({ issue, status, afterId }) => {
      // Si hubiera una consulta en vuelo, su respuesta pisaría el movimiento.
      await queryClient.cancelQueries({ queryKey: queryKeys.issues.all })
      const page = queryClient.getQueryData<IssuePage>(boardKey)
      const changedColumn = status !== issue.status
      replaceIssue({
        ...issue,
        status,
        // La posición se calcula igual que en el servidor, para que ya se vea en su lugar.
        position: positionForDrop(page?.items ?? [], issue, status, afterId),
        // Cambiar de lugar dentro de la columna no es una edición: no toca la fecha.
        updatedAt: changedColumn ? new Date() : issue.updatedAt,
      })
      // Copia de la tarjeta antes de moverla, para poder devolverla.
      return { previous: issue }
    },

    onError: (error, { issue, status }, context) => {
      // Solo se devuelve ESA tarjeta: si hubo otros movimientos en curso, siguen.
      if (context) replaceIssue(context.previous)
      const reason = isApiError(error)
        ? apiErrorMessage(error)
        : apiErrorMessage({ code: 'INTERNAL', message: '' })
      const what =
        status === issue.status
          ? `cambiar de lugar «${issue.title}»`
          : `mover «${issue.title}» a «${STATUS_LABEL[status]}»`
      toast.error(`No se pudo ${what}: ${reason}`)
    },

    onSuccess: (_updated, { issue, status }) => {
      // Cambiar de lugar dentro de la misma columna se ve solo: no hace falta aviso.
      if (status !== issue.status) {
        toast.success(`«${issue.title}» pasó a «${STATUS_LABEL[status]}»`)
      }
    },

    onSettled: () => {
      // Con varios movimientos a la vez, solo el último refresca desde el servidor.
      if (queryClient.isMutating({ mutationKey: MOVE_KEY }) === 1) {
        return queryClient.invalidateQueries({ queryKey: queryKeys.issues.all })
      }
    },
  })
}
