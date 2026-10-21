// Posición de una tarjeta que se coloca entre otras dos (menor = más arriba).
// Se promedian las posiciones de las vecinas: así una sola fila cambia y las
// demás no se tocan. Es la misma cuenta en el servidor (la que vale) y en el
// navegador (la que se ve mientras llega la respuesta).
//   - sin vecina de arriba: va al principio (un poco menos que la primera)
//   - sin vecina de abajo:  va al final (un poco más que la última)
export function slotBetween(
  previous: number | null,
  next: number | null,
): number {
  if (previous === null && next === null) return 0
  if (previous === null) return (next as number) - 1
  if (next === null) return previous + 1
  return (previous + next) / 2
}

// La posición más baja que sea mayor a `previous` (la vecina de abajo), o null
// si `previous` ya es la última.
export function nextPositionAfter(
  positions: number[],
  previous: number,
): number | null {
  let next: number | null = null
  for (const position of positions) {
    if (position > previous && (next === null || position < next)) {
      next = position
    }
  }
  return next
}

// ¿Cabe de verdad entre las dos vecinas? Falla cuando se promedió tantas veces
// que el número ya no tiene más decimales: entonces hay que renumerar la columna.
export function fitsBetween(
  slot: number,
  previous: number,
  next: number | null,
): boolean {
  return slot > previous && (next === null || slot < next)
}
