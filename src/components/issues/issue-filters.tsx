import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { hasActiveFilters, type IssueSearch } from '@/lib/issue-filters'
import { PRIORITY_LABEL, STATUS_LABEL } from '@/lib/labels'
import { PRIORITIES, STATUSES, type OrgUser } from '@/lib/types'

interface Props {
  filters: IssueSearch
  users: OrgUser[] | undefined
  onChange: (patch: Partial<IssueSearch>) => void
  onClear: () => void
  // En el tablero el estado ya es la columna: no hace falta filtrarlo.
  hideStatus?: boolean
}

const SEARCH_DELAY_MS = 300

// Cada cambio de filtro vuelve a la página 1 (`page: undefined`).
export function IssueFilters({
  filters,
  users,
  onChange,
  onClear,
  hideStatus = false,
}: Props) {
  const [text, setText] = useState(filters.q ?? '')
  const debouncedText = useDebouncedValue(text.trim(), SEARCH_DELAY_MS)
  const lastSearch = useRef(filters.q ?? '')

  // La búsqueda se manda al servidor solo cuando se deja de escribir.
  useEffect(() => {
    if (debouncedText === lastSearch.current) return
    lastSearch.current = debouncedText
    onChange({ q: debouncedText || undefined, page: undefined })
  }, [debouncedText, onChange])

  return (
    <div
      className={
        hideStatus
          ? 'grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_9rem_12rem_auto]'
          : 'grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_9rem_12rem_auto]'
      }
    >
      <div className="relative sm:col-span-2 lg:col-span-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Buscar issues"
          placeholder="Buscar por título o descripción"
          className="pl-8"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </div>

      {!hideStatus && (
        <NativeSelect
          aria-label="Filtrar por estado"
          value={filters.status ?? ''}
          onChange={(event) =>
            onChange({
              status: (event.target.value ||
                undefined) as IssueSearch['status'],
              page: undefined,
            })
          }
        >
          <option value="">Todos los estados</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </NativeSelect>
      )}

      <NativeSelect
        aria-label="Filtrar por prioridad"
        value={filters.priority ?? ''}
        onChange={(event) =>
          onChange({
            priority: (event.target.value ||
              undefined) as IssueSearch['priority'],
            page: undefined,
          })
        }
      >
        <option value="">Toda prioridad</option>
        {PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {PRIORITY_LABEL[priority]}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect
        aria-label="Filtrar por responsable"
        value={filters.assignee ?? ''}
        onChange={(event) =>
          onChange({
            assignee: event.target.value || undefined,
            page: undefined,
          })
        }
      >
        <option value="">Todos los responsables</option>
        <option value="unassigned">Sin asignar</option>
        {users?.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </NativeSelect>

      {hasActiveFilters(filters) && (
        <Button variant="ghost" onClick={onClear}>
          Limpiar filtros
        </Button>
      )}
    </div>
  )
}
