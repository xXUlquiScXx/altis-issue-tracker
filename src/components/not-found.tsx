import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

// Página que se muestra cuando la dirección no existe (error 404).
export function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center p-4 text-center">
      <div className="space-y-3">
        <p className="text-6xl font-bold text-muted-foreground">404</p>
        <h1 className="text-xl font-semibold">Página no encontrada</h1>
        <p className="text-sm text-muted-foreground">
          La dirección no existe o fue movida.
        </p>
        <Button asChild>
          <Link to="/">Ir al inicio</Link>
        </Button>
      </div>
    </main>
  )
}
