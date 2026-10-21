import { useDraggable } from '@dnd-kit/core'
import { GripVertical, Lock } from 'lucide-react'
import { PriorityBadge } from '@/components/issues/issue-badges'
import { NativeSelect } from '@/components/ui/native-select'
import { isPlainClick } from '@/lib/click'
import { STATUS_LABEL } from '@/lib/labels'
import { STATUSES, type IssueDto, type Status } from '@/lib/types'
import { cn } from '@/lib/utils'

const LOCKED_TEXT =
  'Solo la persona asignada o un administrador puede mover esta tarjeta'

interface Props {
  issue: IssueDto
  href: string
  // ¿Esta persona puede cambiar el estado? (lo decide `can`, igual que el servidor)
  canMove: boolean
  onView: (issue: IssueDto) => void
  onMove: (status: Status) => void
}

export function KanbanCard({ issue, href, canMove, onView, onMove }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useDraggable({ id: issue.id, disabled: !canMove })

  return (
    <li
      ref={setNodeRef}
      className={cn(
        'space-y-2 rounded-lg border bg-card p-3 text-sm shadow-xs',
        isDragging && 'opacity-40',
      )}
      onClick={(event) => {
        // Los controles de la tarjeta (enlace, asa, selector) tienen su propia acción.
        if ((event.target as HTMLElement).closest('a, button, select')) return
        onView(issue)
      }}
    >
      <div className="flex items-start gap-2">
        <a
          href={href}
          // Sin esto, el navegador intenta arrastrar el enlace en vez de la tarjeta.
          draggable={false}
          className="min-w-0 flex-1 font-medium break-words hover:underline"
          onClick={(event) => {
            if (!isPlainClick(event)) return
            event.preventDefault()
            onView(issue)
          }}
        >
          {issue.title}
        </a>
        {canMove ? (
          // El asa es lo que se agarra para arrastrar (con mouse, dedo o teclado).
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            type="button"
            aria-label={`Arrastrar «${issue.title}»`}
            className="-mt-0.5 -mr-1 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        ) : (
          <span
            role="img"
            aria-label={LOCKED_TEXT}
            title={LOCKED_TEXT}
            className="-mt-0.5 -mr-1 p-1 text-muted-foreground"
          >
            <Lock className="size-4" />
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={issue.priority} />
        <span className="text-xs text-muted-foreground">
          {issue.assigneeName ?? 'Sin asignar'}
        </span>
      </div>

      {issue.labels.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {issue.labels.join(' · ')}
        </p>
      )}

      {/* Alternativa al arrastre: sirve con teclado, lectores de pantalla y en el celular. */}
      {canMove && (
        <NativeSelect
          aria-label={`Mover «${issue.title}» a`}
          className="h-7 text-xs"
          value={issue.status}
          onChange={(event) => onMove(event.target.value as Status)}
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status === issue.status
                ? `Estado: ${STATUS_LABEL[status]}`
                : `Mover a ${STATUS_LABEL[status]}`}
            </option>
          ))}
        </NativeSelect>
      )}
    </li>
  )
}

// La tarjeta "flotante" que sigue al cursor mientras se arrastra.
export function KanbanCardPreview({ issue }: { issue: IssueDto }) {
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3 text-sm shadow-lg">
      <p className="font-medium break-words">{issue.title}</p>
      <PriorityBadge priority={issue.priority} />
    </div>
  )
}
