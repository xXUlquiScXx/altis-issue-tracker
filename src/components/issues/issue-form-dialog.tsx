import { useState, type FocusEvent, type SubmitEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { useIssueMutations } from '@/hooks/use-issue-mutations'
import { useOrgUsers } from '@/hooks/use-org-users'
import { useRefreshIssueLists } from '@/hooks/use-refresh-issue-lists'
import { useVisibleAreaStyle } from '@/hooks/use-visible-area'
import { isApiError } from '@/lib/api'
import { fieldErrorsFrom } from '@/lib/forms'
import { PRIORITY_LABEL, STATUS_LABEL } from '@/lib/labels'
import { apiErrorMessage, translateFields } from '@/lib/messages'
import {
  createIssueSchema,
  updateIssueSchema,
  type CreateIssueFormInput,
  type UpdateIssueFormInput,
} from '@/lib/schemas'
import {
  PRIORITIES,
  STATUSES,
  type IssueDto,
  type SessionUser,
} from '@/lib/types'
import { can } from '@/server/authz'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: SessionUser
  // Si viene un issue se edita; si no, se crea uno nuevo.
  issue?: IssueDto
}

export function IssueFormDialog({ open, onOpenChange, user, issue }: Props) {
  // En el celular el teclado tapa la pantalla: el diálogo se ajusta a lo visible.
  const visibleArea = useVisibleAreaStyle()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={visibleArea}
        className="max-h-[90svh] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{issue ? 'Editar issue' : 'Nuevo issue'}</DialogTitle>
          <DialogDescription>
            {issue
              ? 'Cambia los datos y guarda.'
              : 'Describe el trabajo que hay que hacer.'}
          </DialogDescription>
        </DialogHeader>
        {/* El formulario se monta al abrir: siempre empieza con los datos del issue. */}
        <IssueForm
          user={user}
          issue={issue}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

// Al enfocar un campo se espera a que termine de salir el teclado y se lleva el
// campo al centro del área visible, para no escribir "a ciegas".
function revealFocusedField(event: FocusEvent<HTMLFormElement>) {
  const field = event.target as HTMLElement
  setTimeout(
    () => field.scrollIntoView?.({ block: 'center', behavior: 'smooth' }),
    300,
  )
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null
}

function IssueForm({
  user,
  issue,
  onDone,
}: {
  user: SessionUser
  issue?: IssueDto
  onDone: () => void
}) {
  const { create, update } = useIssueMutations()
  const { data: users } = useOrgUsers()
  const refreshLists = useRefreshIssueLists()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const pending = create.isPending || update.isPending

  // Solo el admin elige responsable. El member crea issues para sí mismo.
  const canAssign = can(user, 'issue:assign', {
    orgId: user.orgId,
    assigneeId: issue?.assigneeId ?? null,
  })

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const labels = String(form.get('labels') ?? '')
      .split(',')
      .map((label) => label.trim())
      .filter(Boolean)
    const values = {
      title: form.get('title'),
      description: form.get('description'),
      status: form.get('status'),
      priority: form.get('priority'),
      labels,
      ...(canAssign
        ? { assigneeId: String(form.get('assigneeId') ?? '') || null }
        : {}),
    }

    // Mismos esquemas que usa el servidor: el feedback es inmediato, pero el
    // servidor igual vuelve a validar.
    const parsed = issue
      ? updateIssueSchema.safeParse({ id: issue.id, ...values })
      : createIssueSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(translateFields(fieldErrorsFrom(parsed.error)))
      return
    }
    setErrors({})

    try {
      // Se envían los datos ya validados y limpios (título recortado, etc.).
      if (issue) await update.mutateAsync(parsed.data as UpdateIssueFormInput)
      else await create.mutateAsync(parsed.data as CreateIssueFormInput)
      onDone()
    } catch (error) {
      if (isApiError(error, 'VALIDATION')) {
        setErrors(translateFields(error.fields))
      } else if (isApiError(error, 'NOT_FOUND')) {
        // El issue ya no existe (otra persona lo borró): se avisa, se cierra y
        // la lista se actualiza para que deje de mostrarlo.
        toast.error(apiErrorMessage(error))
        refreshLists()
        onDone()
      }
      // 401, 403 y 500 ya se avisan con un toast desde el manejo central.
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onFocus={revealFocusedField}
      noValidate
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          name="title"
          defaultValue={issue?.title}
          aria-invalid={!!errors.title}
          autoFocus
        />
        <FieldError message={errors.title} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción (admite Markdown)</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={issue?.description ?? ''}
          aria-invalid={!!errors.description}
        />
        <FieldError message={errors.description} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <NativeSelect
            id="status"
            name="status"
            defaultValue={issue?.status ?? 'todo'}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Prioridad</Label>
          <NativeSelect
            id="priority"
            name="priority"
            defaultValue={issue?.priority ?? 'med'}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABEL[priority]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="assigneeId">Responsable</Label>
        {canAssign ? (
          <NativeSelect
            id="assigneeId"
            name="assigneeId"
            defaultValue={issue?.assigneeId ?? ''}
            aria-invalid={!!errors.assigneeId}
          >
            <option value="">Sin asignar</option>
            {users?.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <p className="text-sm text-muted-foreground">
            {issue
              ? (issue.assigneeName ?? 'Sin asignar')
              : 'Se te asignará a ti'}
          </p>
        )}
        <FieldError message={errors.assigneeId} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="labels">Etiquetas (separadas por coma)</Label>
        <Input
          id="labels"
          name="labels"
          placeholder="bug, ui"
          defaultValue={issue?.labels.join(', ')}
          aria-invalid={!!errors.labels}
        />
        <FieldError message={errors.labels} />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando...' : issue ? 'Guardar cambios' : 'Crear issue'}
        </Button>
      </DialogFooter>
    </form>
  )
}
