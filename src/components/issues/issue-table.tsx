import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { isPlainClick } from '@/lib/click'
import { formatDate } from '@/lib/format'
import type { IssueDto, SessionUser } from '@/lib/types'
import { can } from '@/server/authz'
import { PriorityBadge, StatusBadge } from './issue-badges'

interface Props {
  issues: IssueDto[]
  user: SessionUser
  // Dirección real del detalle: sirve para abrir en otra pestaña o copiar el enlace.
  issueHref: (issue: IssueDto) => string
  onView: (issue: IssueDto) => void
  onEdit: (issue: IssueDto) => void
  onDelete: (issue: IssueDto) => void
}

export function IssueTable({
  issues,
  user,
  issueHref,
  onView,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableCaption className="sr-only">Lista de issues</TableCaption>
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
                {/* Toda la celda abre el detalle (cómodo con el dedo). El título es
                    un enlace real para teclado, lectores de pantalla y "abrir en
                    otra pestaña". */}
                <TableCell
                  className="max-w-xs cursor-pointer whitespace-normal hover:bg-muted/50"
                  onClick={(event) => {
                    // Si el clic fue sobre el enlace, ya lo manejó el enlace.
                    if ((event.target as HTMLElement).closest('a')) return
                    onView(issue)
                  }}
                >
                  <a
                    href={issueHref(issue)}
                    className="rounded font-medium hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    onClick={(event) => {
                      if (!isPlainClick(event)) return
                      event.preventDefault()
                      onView(issue)
                    }}
                  >
                    {issue.title}
                  </a>
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
                  {/* La columna de fecha solo cabe en pantallas grandes: abajo se pliega. */}
                  <p className="mt-1.5 text-xs text-muted-foreground lg:hidden">
                    Actualizado {formatDate(issue.updatedAt)}
                  </p>
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
                  {formatDate(issue.updatedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="max-sm:size-9"
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
                        className="max-sm:size-9"
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
