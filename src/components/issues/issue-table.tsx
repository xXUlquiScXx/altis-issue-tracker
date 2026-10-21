import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { IssueDto, SessionUser } from '@/lib/types'
import { can } from '@/server/authz'
import { PriorityBadge, StatusBadge } from './issue-badges'

interface Props {
  issues: IssueDto[]
  user: SessionUser
  onEdit: (issue: IssueDto) => void
  onDelete: (issue: IssueDto) => void
}

const dateFormat = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function IssueTable({ issues, user, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead className="hidden md:table-cell">Estado</TableHead>
            <TableHead className="hidden md:table-cell">Prioridad</TableHead>
            <TableHead className="hidden md:table-cell">Responsable</TableHead>
            <TableHead className="hidden lg:table-cell">Actualizado</TableHead>
            <TableHead className="w-24 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((issue) => {
            // La UI solo oculta botones; el servidor vuelve a comprobar todo.
            const resource = { orgId: user.orgId, assigneeId: issue.assigneeId }
            const canEdit = can(user, 'issue:update', resource)
            const canDelete = can(user, 'issue:delete', resource)

            return (
              <TableRow key={issue.id}>
                <TableCell className="max-w-xs whitespace-normal">
                  <p className="font-medium">{issue.title}</p>
                  {issue.labels.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {issue.labels.join(' · ')}
                    </p>
                  )}
                  {/* En pantallas chicas las columnas se pliegan bajo el título. */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 md:hidden">
                    <StatusBadge status={issue.status} />
                    <PriorityBadge priority={issue.priority} />
                    <span className="text-xs text-muted-foreground">
                      {issue.assigneeName ?? 'Sin asignar'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <StatusBadge status={issue.status} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <PriorityBadge priority={issue.priority} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {issue.assigneeName ?? (
                    <span className="text-muted-foreground">Sin asignar</span>
                  )}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {dateFormat.format(issue.updatedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${issue.title}`}
                        onClick={() => onEdit(issue)}
                      >
                        <Pencil />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Eliminar ${issue.title}`}
                        onClick={() => onDelete(issue)}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
