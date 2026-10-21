import { createServerFn } from '@tanstack/react-start'
import {
  createIssueSchema,
  issueIdSchema,
  listIssuesSchema,
  moveIssueSchema,
  updateIssueSchema,
} from '@/lib/schemas'
import { requireUser } from '../middleware'
import { validate } from '../validate'
import {
  createIssueForUser,
  deleteIssueForUser,
  getIssueForUser,
  listEventsForIssue,
  listUsersInOrg,
  moveIssueForUser,
  searchIssues,
  updateIssueForUser,
} from './service'

// Todas exigen sesión (requireUser). La org y el rol salen de `context.user`,
// nunca de lo que mande el cliente.

export const listIssues = createServerFn()
  .middleware([requireUser])
  .validator(validate(listIssuesSchema))
  .handler(({ data, context }) => searchIssues(context.user, data))

export const getIssue = createServerFn()
  .middleware([requireUser])
  .validator(validate(issueIdSchema))
  .handler(({ data, context }) => getIssueForUser(context.user, data.id))

export const createIssue = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(validate(createIssueSchema))
  .handler(({ data, context }) => createIssueForUser(context.user, data))

export const updateIssue = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(validate(updateIssueSchema))
  .handler(({ data, context }) => updateIssueForUser(context.user, data))

// Mover una tarjeta del kanban (de columna y/o de lugar dentro de la columna).
export const moveIssue = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(validate(moveIssueSchema))
  .handler(({ data, context }) => moveIssueForUser(context.user, data))

export const deleteIssue = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(validate(issueIdSchema))
  .handler(({ data, context }) => deleteIssueForUser(context.user, data.id))

export const listOrgUsers = createServerFn()
  .middleware([requireUser])
  .handler(({ context }) => listUsersInOrg(context.user))

// Historial de solo lectura. No hay funciones para editar ni borrar eventos.
export const listIssueEvents = createServerFn()
  .middleware([requireUser])
  .validator(validate(issueIdSchema))
  .handler(({ data, context }) => listEventsForIssue(context.user, data.id))
