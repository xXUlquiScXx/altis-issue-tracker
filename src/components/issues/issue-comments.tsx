import { useQuery } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { useState, type SubmitEvent } from 'react'
import { toast } from 'sonner'
import { Markdown } from '@/components/markdown'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useCommentMutations } from '@/hooks/use-comment-mutations'
import { api, isApiError } from '@/lib/api'
import { fieldErrorsFrom } from '@/lib/forms'
import { formatDateTime } from '@/lib/format'
import { apiErrorMessage, translateFields } from '@/lib/messages'
import { queryKeys } from '@/lib/query-keys'
import { createCommentSchema, updateCommentSchema } from '@/lib/schemas'
import type { CommentDto, SessionUser } from '@/lib/types'
import { can } from '@/server/authz'
import { listComments } from '@/server/comments/functions'

interface Props {
  issueId: string
  user: SessionUser
}

export function IssueComments({ issueId, user }: Props) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.issues.comments(issueId),
    queryFn: () => api(() => listComments({ data: { issueId } })),
  })

  return (
    <section aria-labelledby="comments-title" className="space-y-3">
      <h2 id="comments-title" className="text-sm font-semibold">
        Comentarios{data ? ` (${data.length})` : ''}
      </h2>

      {isPending ? (
        <div className="space-y-2" aria-busy aria-label="Cargando comentarios">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="space-y-2 rounded-lg border border-destructive/40 p-4 text-center"
        >
          <p className="text-sm font-medium">
            No se pudieron cargar los comentarios
          </p>
          <p className="text-sm text-muted-foreground">
            {isApiError(error)
              ? apiErrorMessage(error)
              : apiErrorMessage({ code: 'INTERNAL', message: '' })}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : data.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Aún no hay comentarios. Escribe el primero.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              issueId={issueId}
              user={user}
            />
          ))}
        </ul>
      )}

      <NewCommentForm issueId={issueId} />
    </section>
  )
}

function NewCommentForm({ issueId }: { issueId: string }) {
  const { create } = useCommentMutations(issueId)
  const [error, setError] = useState('')

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const parsed = createCommentSchema.safeParse({
      issueId,
      body: new FormData(form).get('body'),
    })
    if (!parsed.success) {
      setError(translateFields(fieldErrorsFrom(parsed.error)).body ?? '')
      return
    }
    setError('')

    try {
      await create.mutateAsync(parsed.data)
      form.reset()
    } catch (e) {
      if (isApiError(e, 'VALIDATION')) {
        setError(translateFields(e.fields).body ?? apiErrorMessage(e))
      } else if (isApiError(e, 'NOT_FOUND')) {
        toast.error(apiErrorMessage(e))
      }
      // 401, 403 y 500 ya se avisan con un toast desde el manejo central.
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-2">
      <Label htmlFor="new-comment" className="sr-only">
        Nuevo comentario
      </Label>
      <Textarea
        id="new-comment"
        name="body"
        rows={3}
        placeholder="Escribe un comentario (admite Markdown)"
        aria-invalid={!!error}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={create.isPending}>
          {create.isPending ? 'Publicando...' : 'Comentar'}
        </Button>
      </div>
    </form>
  )
}

function CommentItem({
  comment,
  issueId,
  user,
}: {
  comment: CommentDto
  issueId: string
  user: SessionUser
}) {
  const { update, remove } = useCommentMutations(issueId)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState('')

  // Solo el autor edita o borra, aunque quien mire sea admin.
  const resource = { orgId: user.orgId, authorId: comment.authorId }
  const canEdit = can(user, 'comment:update', resource)
  const canDelete = can(user, 'comment:delete', resource)
  const edited = comment.updatedAt.getTime() > comment.createdAt.getTime()

  async function handleSave(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = updateCommentSchema.safeParse({
      id: comment.id,
      body: new FormData(event.currentTarget).get('body'),
    })
    if (!parsed.success) {
      setError(translateFields(fieldErrorsFrom(parsed.error)).body ?? '')
      return
    }
    setError('')

    try {
      await update.mutateAsync(parsed.data)
      setEditing(false)
    } catch (e) {
      if (isApiError(e, 'VALIDATION')) {
        setError(translateFields(e.fields).body ?? apiErrorMessage(e))
      } else if (isApiError(e, 'NOT_FOUND')) {
        toast.error(apiErrorMessage(e))
        setEditing(false)
      }
    }
  }

  async function handleDelete() {
    try {
      await remove.mutateAsync(comment.id)
    } catch (e) {
      if (isApiError(e, 'NOT_FOUND')) toast.error(apiErrorMessage(e))
      setConfirmingDelete(false)
    }
  }

  return (
    <li className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <p className="text-sm font-medium">{comment.authorName}</p>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(comment.createdAt)}
          {edited && ' · editado'}
        </p>
      </div>

      {editing ? (
        <form onSubmit={handleSave} noValidate className="space-y-2">
          <Label htmlFor={`edit-${comment.id}`} className="sr-only">
            Editar comentario
          </Label>
          <Textarea
            id={`edit-${comment.id}`}
            name="body"
            rows={3}
            defaultValue={comment.body}
            aria-invalid={!!error}
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(false)
                setError('')
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      ) : (
        <Markdown>{comment.body}</Markdown>
      )}

      {!editing && (canEdit || canDelete) && (
        <div className="flex justify-end gap-1">
          {confirmingDelete ? (
            <>
              <span className="mr-1 self-center text-sm">
                ¿Eliminar este comentario?
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmingDelete(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={remove.isPending}
                onClick={handleDelete}
              >
                {remove.isPending ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </>
          ) : (
            <>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Editar comentario de ${comment.authorName}`}
                  onClick={() => setEditing(true)}
                >
                  <Pencil />
                  Editar
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Eliminar comentario de ${comment.authorName}`}
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 />
                  Eliminar
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </li>
  )
}
