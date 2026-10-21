import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useIssueMutations } from '@/hooks/use-issue-mutations'
import { useRefreshIssueLists } from '@/hooks/use-refresh-issue-lists'
import { isApiError } from '@/lib/api'
import { apiErrorMessage } from '@/lib/messages'
import type { IssueDto } from '@/lib/types'

interface Props {
  issue: IssueDto | null
  onClose: () => void
}

export function DeleteIssueDialog({ issue, onClose }: Props) {
  const { remove } = useIssueMutations()
  const refreshLists = useRefreshIssueLists()

  async function confirm() {
    if (!issue) return
    try {
      await remove.mutateAsync(issue.id)
      onClose()
    } catch (error) {
      if (isApiError(error, 'NOT_FOUND')) {
        // Otra persona ya lo había borrado: no queda nada que hacer, solo
        // avisar y actualizar la lista.
        toast.error(apiErrorMessage(error))
        refreshLists()
        onClose()
      }
      // 401, 403 y 500 ya se avisan con un toast desde el manejo central.
    }
  }

  return (
    <Dialog open={issue !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar este issue?</DialogTitle>
          <DialogDescription>
            «{issue?.title}» se eliminará junto con sus comentarios y su
            historial. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={confirm}
          >
            {remove.isPending ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
