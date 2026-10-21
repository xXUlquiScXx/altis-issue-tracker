import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { CreateIssueFormInput, UpdateIssueFormInput } from '@/lib/schemas'
import {
  createIssue,
  deleteIssue,
  updateIssue,
} from '@/server/issues/functions'

// Crear, editar y borrar. Al terminar bien, se invalida todo lo de "issues" para
// que lista, detalle, historial y kanban se vuelvan a pedir y queden coherentes.
export function useIssueMutations() {
  const queryClient = useQueryClient()
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.all })

  const create = useMutation({
    mutationFn: (data: CreateIssueFormInput) =>
      api(() => createIssue({ data })),
    onSuccess: () => {
      toast.success('Issue creado')
      return refresh()
    },
  })

  const update = useMutation({
    mutationFn: (data: UpdateIssueFormInput) =>
      api(() => updateIssue({ data })),
    onSuccess: () => {
      toast.success('Issue actualizado')
      return refresh()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api(() => deleteIssue({ data: { id } })),
    onSuccess: () => {
      toast.success('Issue eliminado')
      return refresh()
    },
  })

  return { create, update, remove }
}
