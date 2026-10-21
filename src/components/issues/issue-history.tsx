import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api, isApiError } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { describeEvent } from '@/lib/history'
import { apiErrorMessage } from '@/lib/messages'
import { queryKeys } from '@/lib/query-keys'
import { listIssueEvents } from '@/server/issues/functions'

// Historial de solo lectura: del cambio más antiguo al más reciente.
export function IssueHistory({ issueId }: { issueId: string }) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.issues.events(issueId),
    queryFn: () => api(() => listIssueEvents({ data: { id: issueId } })),
  })

  return (
    <section aria-labelledby="history-title" className="space-y-3">
      <h2 id="history-title" className="text-sm font-semibold">
        Historial
      </h2>

      {isPending ? (
        <div className="space-y-2" aria-busy aria-label="Cargando historial">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="space-y-2 rounded-lg border border-destructive/40 p-4 text-center"
        >
          <p className="text-sm font-medium">No se pudo cargar el historial</p>
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
          Este issue todavía no tiene historial.
        </p>
      ) : (
        <ol className="space-y-3 border-l pl-4">
          {data.map((event) => (
            <li key={event.id} className="text-sm">
              <p>
                <span className="font-medium">{event.actorName}</span>{' '}
                {describeEvent(event)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(event.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
