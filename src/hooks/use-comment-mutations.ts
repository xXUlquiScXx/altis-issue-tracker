import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { CreateCommentInput, UpdateCommentInput } from '@/lib/schemas'
import {
  createComment,
  deleteComment,
  updateComment,
} from '@/server/comments/functions'

// Publicar, editar y borrar comentarios de un issue. Al terminar bien, se vuelve
// a pedir solo la lista de comentarios de ese issue.
export function useCommentMutations(issueId: string) {
  const queryClient = useQueryClient()
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.issues.comments(issueId),
    })

  const create = useMutation({
    mutationFn: (data: CreateCommentInput) =>
      api(() => createComment({ data })),
    onSuccess: () => {
      toast.success('Comentario publicado')
      return refresh()
    },
  })

  const update = useMutation({
    mutationFn: (data: UpdateCommentInput) =>
      api(() => updateComment({ data })),
    onSuccess: () => {
      toast.success('Comentario actualizado')
      return refresh()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api(() => deleteComment({ data: { id } })),
    onSuccess: () => {
      toast.success('Comentario eliminado')
      return refresh()
    },
  })

  return { create, update, remove }
}
