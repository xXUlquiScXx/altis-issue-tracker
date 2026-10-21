import { useSyncExternalStore } from 'react'
import { getTheme, type Theme } from '@/lib/theme'

// Avisa cuando cambia la clase `dark` de <html> (la pone toggleTheme).
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  return () => observer.disconnect()
}

// Tema actual como valor de React, para componentes de terceros que lo piden
// por prop (como los toasts). En el servidor siempre es 'light'.
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => 'light')
}
