import { useDroppable } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { STATUS_LABEL } from '@/lib/labels'
import type { Status } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  status: Status
  count: number
  children: ReactNode
}

// Una columna del tablero. El `id` del droppable ES el estado: así, al soltar una
// tarjeta, sabemos a qué estado pasarla.
export function KanbanColumn({ status, count, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`column-${status}`}
      className={cn(
        // En celular cada columna ocupa casi todo el ancho y se desliza de lado.
        'flex min-w-[85%] snap-center flex-col gap-2 rounded-xl bg-muted/40 p-2 transition-colors sm:min-w-0 sm:flex-1',
        isOver && 'bg-primary/10 ring-2 ring-primary/40',
      )}
    >
      <header className="flex items-center justify-between px-1 pt-1">
        <h2 id={`column-${status}`} className="text-sm font-semibold">
          {STATUS_LABEL[status]}
        </h2>
        <Badge variant="secondary">{count}</Badge>
      </header>
      <ul className="flex min-h-24 flex-col gap-2">
        {count === 0 ? (
          <li className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Sin issues
          </li>
        ) : (
          children
        )}
      </ul>
    </section>
  )
}
