import { useSyncExternalStore, type CSSProperties } from 'react'

function subscribe(onChange: () => void) {
  const viewport = window.visualViewport
  if (!viewport) return () => {}
  viewport.addEventListener('resize', onChange)
  viewport.addEventListener('scroll', onChange)
  return () => {
    viewport.removeEventListener('resize', onChange)
    viewport.removeEventListener('scroll', onChange)
  }
}

// "alto|desplazamiento" como texto, para que el valor sea estable entre lecturas.
// Vacío si el navegador no lo soporta o si el usuario hizo zoom con los dedos.
function getSnapshot() {
  const viewport = window.visualViewport
  if (!viewport || Math.abs(viewport.scale - 1) > 0.01) return ''
  return `${Math.round(viewport.height)}|${Math.round(viewport.offsetTop)}`
}

// En el celular, el teclado tapa parte de la pantalla pero el navegador no
// siempre encoge la página. `visualViewport` sí dice qué parte se ve realmente.
// Con esto, un diálogo centrado se ajusta al área visible: si no cabe, se
// puede hacer scroll dentro de él y el campo enfocado queda sobre el teclado.
export function useVisibleAreaStyle(): CSSProperties | undefined {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => '')
  if (!snapshot) return undefined
  const [height = 0, offsetTop = 0] = snapshot.split('|').map(Number)
  return { top: offsetTop + height / 2, maxHeight: height - 24 }
}
