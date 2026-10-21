import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  // Qué se actualiza, para lectores de pantalla y tooltip: "Actualizar lista".
  label: string
  // ¿Se está pidiendo algo al servidor ahora mismo?
  isFetching: boolean
  onRefresh: () => void
}

// Vuelve a pedir los datos que están en pantalla, sin recargar toda la página.
// Mientras trabaja, el ícono gira y el botón queda deshabilitado (evita pedir
// diez veces seguidas).
export function RefreshButton({ label, isFetching, onRefresh }: Props) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      title={label}
      aria-busy={isFetching}
      disabled={isFetching}
      onClick={onRefresh}
    >
      <RefreshCw className={cn(isFetching && 'animate-spin')} />
    </Button>
  )
}
