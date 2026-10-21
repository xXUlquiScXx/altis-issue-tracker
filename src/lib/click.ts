import type { MouseEvent } from 'react'

// Clic normal: se navega dentro de la app sin recargar. Con Ctrl, Cmd, Shift o
// clic central se deja que el navegador abra el enlace en otra pestaña o ventana.
export function isPlainClick(event: MouseEvent) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  )
}
