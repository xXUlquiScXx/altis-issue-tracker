import { createServerFn } from '@tanstack/react-start'
import {
  commentIdSchema,
  createCommentSchema,
  listCommentsSchema,
  updateCommentSchema,
} from '@/lib/schemas'
import { requireUser } from '../middleware'
import { validate } from '../validate'
import {
  createCommentForUser,
  deleteCommentForUser,
  listCommentsForIssue,
  updateCommentForUser,
} from './service'

// Todas exigen sesión (requireUser). La org y el autor salen de `context.user`,
// nunca de lo que mande el cliente.

export const listComments = createServerFn()
  .middleware([requireUser])
  .validator(validate(listCommentsSchema))
  .handler(({ data, context }) =>
    listCommentsForIssue(context.user, data.issueId),
  )

export const createComment = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(validate(createCommentSchema))
  .handler(({ data, context }) => createCommentForUser(context.user, data))

export const updateComment = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(validate(updateCommentSchema))
  .handler(({ data, context }) => updateCommentForUser(context.user, data))

export const deleteComment = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(validate(commentIdSchema))
  .handler(({ data, context }) => deleteCommentForUser(context.user, data.id))
