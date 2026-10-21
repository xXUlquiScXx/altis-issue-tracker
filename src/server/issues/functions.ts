import { createServerFn } from '@tanstack/react-start'
import {
  createIssueSchema,
  issueIdSchema,
  listIssuesSchema,
  updateIssueSchema,
} from '@/lib/schemas'
import { requireUser } from '../middleware'
import { validate } from '../validate'
import {
  createIssueForUser,
  deleteIssueForUser,
  getIssueForUser,
  listUsersInOrg,
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

export const deleteIssue = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(validate(issueIdSchema))
  .handler(({ data, context }) => deleteIssueForUser(context.user, data.id))

export const listOrgUsers = createServerFn()
  .middleware([requireUser])
  .handler(({ context }) => listUsersInOrg(context.user))
