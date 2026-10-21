import { Badge } from '@/components/ui/badge'
import { PRIORITY_LABEL, STATUS_LABEL } from '@/lib/labels'
import type { Priority, Status } from '@/lib/types'

const STATUS_VARIANT = {
  todo: 'secondary',
  in_progress: 'default',
  done: 'outline',
} as const

const PRIORITY_VARIANT = {
  low: 'outline',
  med: 'secondary',
  high: 'destructive',
} as const

export function StatusBadge({ status }: { status: Status }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge variant={PRIORITY_VARIANT[priority]}>
      {PRIORITY_LABEL[priority]}
    </Badge>
  )
}
