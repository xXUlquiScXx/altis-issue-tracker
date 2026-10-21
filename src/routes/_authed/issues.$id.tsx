import { createFileRoute, useRouter } from '@tanstack/react-router'
import { IssueDetailPage } from '@/components/issues/issue-detail-page'

export const Route = createFileRoute('/_authed/issues/$id')({
  component: IssueDetailRoute,
})

function IssueDetailRoute() {
  const { id } = Route.useParams()
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const navigate = Route.useNavigate()

  // "Volver" retrocede en el historial: la lista reaparece tal como se dejó
  // (mismos filtros y página en la URL, y el mismo scroll). Si el enlace se abrió
  // directamente, no hay historial dentro de la app y se va a la lista.
  function goBack() {
    if (router.history.canGoBack()) router.history.back()
    else void navigate({ to: '/' })
  }

  return (
    <main className="mx-auto max-w-3xl p-4">
      <IssueDetailPage issueId={id} user={user} onBack={goBack} />
    </main>
  )
}
