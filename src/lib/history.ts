import { PRIORITY_LABEL, STATUS_LABEL } from './labels'
import type { IssueEventDto } from './types'

// Para status y priority el servidor guarda el valor en inglés ('in_progress');
// aquí se muestra en español. Si llega algo desconocido, se muestra tal cual.
function label(labels: Record<string, string>, value: string | null) {
  if (value === null) return '—'
  return labels[value] ?? value
}

// Frase del historial sin el nombre de quien actuó:
//   "cambió el estado de «Por hacer» a «En progreso»"
export function describeEvent(event: IssueEventDto): string {
  switch (event.type) {
    case 'created':
      return 'creó el issue'
    case 'status_changed':
      return `cambió el estado de «${label(STATUS_LABEL, event.fromValue)}» a «${label(STATUS_LABEL, event.toValue)}»`
    case 'priority_changed':
      return `cambió la prioridad de «${label(PRIORITY_LABEL, event.fromValue)}» a «${label(PRIORITY_LABEL, event.toValue)}»`
    case 'title_changed':
      return `cambió el título de «${event.fromValue ?? '—'}» a «${event.toValue ?? '—'}»`
    case 'description_changed':
      return 'cambió la descripción'
    case 'labels_changed':
      if (!event.fromValue) return `agregó las etiquetas «${event.toValue}»`
      if (!event.toValue) return 'quitó todas las etiquetas'
      return `cambió las etiquetas de «${event.fromValue}» a «${event.toValue}»`
    case 'assignee_changed': {
      // Los nombres pueden faltar si la persona ya no está en la organización.
      const from = event.fromName ?? 'otra persona'
      const to = event.toName ?? 'otra persona'
      if (!event.fromValue) return `asignó el issue a ${to}`
      if (!event.toValue) return `quitó la asignación de ${from}`
      return `cambió el responsable de ${from} a ${to}`
    }
  }
}
