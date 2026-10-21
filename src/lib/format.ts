const dateFormat = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

// Fecha corta en español para la UI (ej. "1 de oct de 2026").
export function formatDate(date: Date) {
  return dateFormat.format(date)
}

const dateTimeFormat = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

// Fecha y hora para el detalle (ej. "1 de oct de 2026, 3:05 p. m.").
export function formatDateTime(date: Date) {
  return dateTimeFormat.format(date)
}
