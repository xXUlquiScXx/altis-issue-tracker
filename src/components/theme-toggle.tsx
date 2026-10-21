import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toggleTheme } from '@/lib/theme'

// Botón sol/luna. Los dos íconos están en el HTML y el CSS (`dark:`) muestra
// el que corresponde: así no parpadea ni depende de JavaScript para el ícono.
export function ThemeToggle({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      aria-label="Cambiar entre tema claro y oscuro"
      title="Cambiar tema"
      onClick={toggleTheme}
    >
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </Button>
  )
}
