import { Toaster } from 'sonner'
import { useTheme } from '@/hooks/use-theme'

// Contenedor de los avisos (toasts). Sigue el tema claro/oscuro de la app.
export function AppToaster() {
  return <Toaster theme={useTheme()} richColors closeButton />
}
