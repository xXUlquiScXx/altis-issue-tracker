import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { comments, issues, users } from '@/db/schema'
import type { CreateCommentInput, UpdateCommentInput } from '@/lib/schemas'
import type { CommentDto, SessionUser } from '@/lib/types'
import { can } from '../authz'
import { AppError } from '../errors'
import type { Executor } from '../executor'

function selectComments(executor: Executor) {
  return executor
    .select({
      id: comments.id,
      issueId: comments.issueId,
      authorId: comments.authorId,
      authorName: users.name,
      body: comments.body,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
}

// El issue debe ser de la org de la sesión; si no, es como si no existiera.
async function findIssueResource(user: SessionUser, issueId: string) {
  const [issue] = await db
    .select({ orgId: issues.orgId, assigneeId: issues.assigneeId })
    .from(issues)
    .where(and(eq(issues.id, issueId), eq(issues.orgId, user.orgId)))
    .limit(1)
  if (!issue) throw new AppError('NOT_FOUND', 'Issue not found')
  return issue
}

async function getCommentDto(user: SessionUser, id: string) {
  const [comment] = await selectComments(db)
    .where(and(eq(comments.id, id), eq(comments.orgId, user.orgId)))
    .limit(1)
  if (!comment) throw new AppError('NOT_FOUND', 'Comment not found')
  return comment
}

// Fila cruda del comentario, para decidir permisos. Mismo filtro por org.
async function findCommentRow(user: SessionUser, id: string) {
  const [comment] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.id, id), eq(comments.orgId, user.orgId)))
    .limit(1)
  if (!comment) throw new AppError('NOT_FOUND', 'Comment not found')
  return comment
}

export async function listCommentsForIssue(
  user: SessionUser,
  issueId: string,
): Promise<CommentDto[]> {
  await findIssueResource(user, issueId)
  return selectComments(db)
    .where(and(eq(comments.issueId, issueId), eq(comments.orgId, user.orgId)))
    .orderBy(asc(comments.createdAt), asc(comments.id))
}

export async function createCommentForUser(
  user: SessionUser,
  input: CreateCommentInput,
): Promise<CommentDto> {
  const issue = await findIssueResource(user, input.issueId)
  if (!can(user, 'comment:create', issue)) {
    throw new AppError('FORBIDDEN', 'You cannot comment on this issue')
  }

  const now = new Date()
  const [created] = await db
    .insert(comments)
    .values({
      issueId: input.issueId,
      orgId: user.orgId,
      authorId: user.id,
      body: input.body,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: comments.id })
  if (!created) throw new Error('Comment insert failed')

  return getCommentDto(user, created.id)
}

export async function updateCommentForUser(
  user: SessionUser,
  input: UpdateCommentInput,
): Promise<CommentDto> {
  const comment = await findCommentRow(user, input.id)
  // Solo el autor edita, aunque quien lo intente sea admin.
  if (!can(user, 'comment:update', comment)) {
    throw new AppError('FORBIDDEN', 'Only the author can edit this comment')
  }

  // Guardar el mismo texto no cuenta como edición.
  if (input.body !== comment.body) {
    await db
      .update(comments)
      .set({ body: input.body, updatedAt: new Date() })
      .where(eq(comments.id, comment.id))
  }
  return getCommentDto(user, comment.id)
}

export async function deleteCommentForUser(
  user: SessionUser,
  id: string,
): Promise<{ id: string }> {
  const comment = await findCommentRow(user, id)
  if (!can(user, 'comment:delete', comment)) {
    throw new AppError('FORBIDDEN', 'Only the author can delete this comment')
  }

  await db.delete(comments).where(eq(comments.id, comment.id))
  return { id: comment.id }
}
