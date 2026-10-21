const dateFormat = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

// Fecha corta en español para la UI (ej. "1 de oct de 2026").
export function formatDate(date: Date) {
  return dateFormat.format(date)
}
