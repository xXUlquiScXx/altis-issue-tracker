import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, isApiError } from '@/lib/api'
import { STATUS_LABEL } from '@/lib/labels'
import { apiErrorMessage } from '@/lib/messages'
import type { ListIssuesInput } from '@/lib/schemas'
import { queryKeys } from '@/lib/query-keys'
import type { IssueDto, IssuePage, Status } from '@/lib/types'
import { updateIssue } from '@/server/issues/functions'

const MOVE_KEY = ['issues', 'move'] as const

interface MoveVariables {
  issue: IssueDto
  status: Status
}

// Mover una tarjeta de columna con actualización optimista: la tarjeta cambia de
// columna al instante, sin esperar al servidor.
//   - onMutate:  se cancelan las consultas en vuelo y se mueve la tarjeta.
//   - onError:   la tarjeta vuelve a su columna y se avisa por qué.
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
    mutationFn: ({ issue, status }: MoveVariables) =>
      api(() => updateIssue({ data: { id: issue.id, status } })),

    onMutate: async ({ issue, status }) => {
      // Si hubiera una consulta en vuelo, su respuesta pisaría el movimiento.
      await queryClient.cancelQueries({ queryKey: queryKeys.issues.all })
      replaceIssue({ ...issue, status, updatedAt: new Date() })
      // Copia de la tarjeta antes de moverla, para poder devolverla.
      return { previous: issue }
    },

    onError: (error, { issue, status }, context) => {
      // Solo se devuelve ESA tarjeta: si hubo otros movimientos en curso, siguen.
      if (context) replaceIssue(context.previous)
      const reason = isApiError(error)
        ? apiErrorMessage(error)
        : apiErrorMessage({ code: 'INTERNAL', message: '' })
      toast.error(
        `No se pudo mover «${issue.title}» a «${STATUS_LABEL[status]}»: ${reason}`,
      )
    },

    onSuccess: (_updated, { issue, status }) => {
      toast.success(`«${issue.title}» pasó a «${STATUS_LABEL[status]}»`)
    },

    onSettled: () => {
      // Con varios movimientos a la vez, solo el último refresca desde el servidor.
      if (queryClient.isMutating({ mutationKey: MOVE_KEY }) === 1) {
        return queryClient.invalidateQueries({ queryKey: queryKeys.issues.all })
      }
    },
  })
}
