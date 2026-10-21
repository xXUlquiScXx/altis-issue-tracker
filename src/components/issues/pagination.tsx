import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  // Distingue las dos barras (arriba y abajo) para lectores de pantalla.
  label: string
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function Pagination({
  label,
  page,
  pageSize,
  total,
  onPageChange,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <nav aria-label={label} className="flex items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        Página {page} de {totalPages} · {total}{' '}
        {total === 1 ? 'issue' : 'issues'}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          aria-label="Página anterior"
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
          <span className="hidden sm:inline">Anterior</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          aria-label="Página siguiente"
          onClick={() => onPageChange(page + 1)}
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight />
        </Button>
      </div>
    </nav>
  )
}
