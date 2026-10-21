import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Link as LinkIcon, Pencil } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Markdown } from '@/components/markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRefreshIssueLists } from '@/hooks/use-refresh-issue-lists'
import { api, isApiError } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { apiErrorMessage } from '@/lib/messages'
import { queryKeys } from '@/lib/query-keys'
import type { IssueDto, SessionUser } from '@/lib/types'
import { can } from '@/server/authz'
import { getIssue } from '@/server/issues/functions'
import { PriorityBadge, StatusBadge } from './issue-badges'
import { IssueComments } from './issue-comments'
import { IssueFormDialog } from './issue-form-dialog'
import { IssueHistory } from './issue-history'

interface Props {
  issueId: string
  user: SessionUser
  // Vuelve a la pantalla anterior (la lista, con sus filtros y página).
  onBack: () => void
}

// Detalle de un issue en su propia página (/issues/<id>): tiene URL, así que se
// puede compartir. Cualquier persona de la org puede verlo; editarlo depende de `can`.
export function IssueDetailPage({ issueId, user, onBack }: Props) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.issues.detail(issueId),
    queryFn: () => api(() => getIssue({ data: { id: issueId } })),
  })

  return (
    <section className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ArrowLeft />
        Volver
      </Button>

      {isPending ? (
        <DetailSkeleton />
      ) : isError ? (
        <DetailError error={error} onRetry={() => refetch()} onBack={onBack} />
      ) : (
        <DetailContent issue={data} user={user} />
      )}
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-3" aria-busy aria-label="Cargando issue">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

function DetailError({
  error,
  onRetry,
  onBack,
}: {
  error: unknown
  onRetry: () => void
  onBack: () => void
}) {
  // Un id inexistente, de otra org o mal escrito se ven igual: no existe para ti.
  const gone = isApiError(error, 'NOT_FOUND') || isApiError(error, 'VALIDATION')

  // Si el issue ya no existe, la lista y el tablero que lo muestran están
  // desactualizados: se marcan para que se vuelvan a pedir al regresar.
  const refreshLists = useRefreshIssueLists()
  useEffect(() => {
    if (gone) refreshLists()
  }, [gone, refreshLists])

  return (
    <div
      role="alert"
      className="space-y-3 rounded-lg border border-dashed p-8 text-center"
    >
      {gone ? (
        <>
          <p className="font-medium">Este issue no existe</p>
          <p className="text-sm text-muted-foreground">
            Pudo ser eliminado, o el enlace no es correcto o pertenece a otra
            organización.
          </p>
          <Button variant="outline" onClick={onBack}>
            Volver
          </Button>
        </>
      ) : (
        <>
          <p className="font-medium">No se pudo cargar el issue</p>
          <p className="text-sm text-muted-foreground">
            {isApiError(error)
              ? apiErrorMessage(error)
              : apiErrorMessage({ code: 'INTERNAL', message: '' })}
          </p>
          <Button variant="outline" onClick={onRetry}>
            Reintentar
          </Button>
        </>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    toast.success('Enlace copiado')
  } catch {
    // Sin permiso para el portapapeles (por ejemplo, página sin HTTPS).
    toast.error('No se pudo copiar el enlace')
  }
}

function DetailContent({
  issue,
  user,
}: {
  issue: IssueDto
  user: SessionUser
}) {
  const [editing, setEditing] = useState(false)
  const canEdit = can(user, 'issue:update', {
    orgId: user.orgId,
    assigneeId: issue.assigneeId,
  })

  return (
    <article className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl leading-tight font-bold break-words">
          {issue.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={issue.status} />
          <PriorityBadge priority={issue.priority} />
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={copyLink}>
              <LinkIcon />
              Copiar enlace
            </Button>
            {canEdit && (
              <Button size="sm" onClick={() => setEditing(true)}>
                <Pencil />
                Editar
              </Button>
            )}
          </div>
        </div>
      </header>

      <dl className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
        <Field label="Responsable">
          {issue.assigneeName ?? (
            <span className="text-muted-foreground">Sin asignar</span>
          )}
        </Field>
        <Field label="Creado por">{issue.createdByName}</Field>
        <Field label="Creado">{formatDateTime(issue.createdAt)}</Field>
        <Field label="Última actualización">
          {formatDateTime(issue.updatedAt)}
        </Field>
        <div className="sm:col-span-2">
          <Field label="Etiquetas">
            {issue.labels.length > 0 ? (
              <span className="flex flex-wrap gap-1">
                {issue.labels.map((label) => (
                  <Badge key={label} variant="outline">
                    {label}
                  </Badge>
                ))}
              </span>
            ) : (
              <span className="text-muted-foreground">Sin etiquetas</span>
            )}
          </Field>
        </div>
      </dl>

      <section aria-labelledby="issue-description" className="space-y-2">
        <h2 id="issue-description" className="text-sm font-semibold">
          Descripción
        </h2>
        {issue.description ? (
          <Markdown>{issue.description}</Markdown>
        ) : (
          <p className="text-sm text-muted-foreground">Sin descripción.</p>
        )}
      </section>

      {/* Cada sección carga sus propios datos, con sus estados de carga y error. */}
      <IssueComments issueId={issue.id} user={user} />
      <IssueHistory issueId={issue.id} />

      <IssueFormDialog
        open={editing}
        onOpenChange={setEditing}
        user={user}
        issue={issue}
      />
    </article>
  )
}
