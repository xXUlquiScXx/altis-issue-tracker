// Fuente única de los valores permitidos: la usan la BD (pgEnum), zod y la UI.
export const ROLES = ['admin', 'member'] as const
export const STATUSES = ['todo', 'in_progress', 'done'] as const
export const PRIORITIES = ['low', 'med', 'high'] as const
export const EVENT_TYPES = [
  'created',
  'status_changed',
  'priority_changed',
  'assignee_changed',
  'title_changed',
  'description_changed',
  'labels_changed',
] as const

export type Role = (typeof ROLES)[number]
export type Status = (typeof STATUSES)[number]
export type Priority = (typeof PRIORITIES)[number]
export type EventType = (typeof EVENT_TYPES)[number]

// Usuario autenticado tal como lo conoce el servidor (y lo recibe la UI).
export interface SessionUser {
  id: string
  orgId: string
  orgName: string
  role: Role
  name: string
  email: string
}

// Issue tal como lo recibe la UI (con los nombres ya resueltos).
export interface IssueDto {
  id: string
  title: string
  description: string | null
  status: Status
  priority: Priority
  assigneeId: string | null
  assigneeName: string | null
  createdBy: string
  createdByName: string
  labels: string[]
  createdAt: Date
  updatedAt: Date
}

export interface IssuePage {
  items: IssueDto[]
  total: number
  page: number
  pageSize: number
}

// Usuario de la org para el selector de assignee y los filtros.
export interface OrgUser {
  id: string
  name: string
  role: Role
}

// Una línea del historial de un issue. Es solo lectura: nunca se edita ni se borra.
export interface IssueEventDto {
  id: string
  type: EventType
  // status/priority: el valor ('todo', 'high'...). assignee: id del usuario o null.
  fromValue: string | null
  toValue: string | null
  // Solo en assignee_changed: los nombres ya resueltos (null = sin asignar).
  fromName: string | null
  toName: string | null
  actorId: string
  actorName: string
  createdAt: Date
}

export interface CommentDto {
  id: string
  issueId: string
  authorId: string
  authorName: string
  body: string
  createdAt: Date
  // Si es posterior a createdAt, el comentario fue editado.
  updatedAt: Date
}
