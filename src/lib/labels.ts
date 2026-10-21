import type { Priority, Role, Status } from './types'

// Textos en español para los valores que la API maneja en inglés.
export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  member: 'Miembro',
}

export const STATUS_LABEL: Record<Status, string> = {
  todo: 'Por hacer',
  in_progress: 'En progreso',
  done: 'Hecho',
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Baja',
  med: 'Media',
  high: 'Alta',
}
