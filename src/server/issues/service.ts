import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
} from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db'
import { issueEvents, issues, users } from '@/db/schema'
import type {
  CreateIssueInput,
  ListIssuesInput,
  UpdateIssueInput,
} from '@/lib/schemas'
import type {
  IssueDto,
  IssueEventDto,
  IssuePage,
  OrgUser,
  SessionUser,
} from '@/lib/types'
import { can } from '../authz'
import { AppError } from '../errors'
import type { Executor } from '../executor'

const assignee = alias(users, 'assignee')
const creator = alias(users, 'creator')

function selectIssues(executor: Executor) {
  return executor
    .select({
      id: issues.id,
      title: issues.title,
      description: issues.description,
      status: issues.status,
      priority: issues.priority,
      assigneeId: issues.assigneeId,
      assigneeName: assignee.name,
      createdBy: issues.createdBy,
      createdByName: creator.name,
      labels: issues.labels,
      createdAt: issues.createdAt,
      updatedAt: issues.updatedAt,
    })
    .from(issues)
    .leftJoin(assignee, eq(assignee.id, issues.assigneeId))
    .innerJoin(creator, eq(creator.id, issues.createdBy))
}

// La org siempre sale de la sesión. Si el issue existe pero es de otra org,
// la respuesta es la misma que si no existiera: NOT_FOUND.
export async function getIssueForUser(
  user: SessionUser,
  id: string,
  executor: Executor = db,
): Promise<IssueDto> {
  const [issue] = await selectIssues(executor)
    .where(and(eq(issues.id, id), eq(issues.orgId, user.orgId)))
    .limit(1)
  if (!issue) throw new AppError('NOT_FOUND', 'Issue not found')
  return issue
}

// Escapa % y _ para que se busquen como texto literal dentro de ILIKE.
function escapeLike(term: string) {
  return term.replace(/[\\%_]/g, '\\$&')
}

export async function searchIssues(
  user: SessionUser,
  input: ListIssuesInput,
): Promise<IssuePage> {
  const conditions = [eq(issues.orgId, user.orgId)]
  if (input.status) conditions.push(eq(issues.status, input.status))
  if (input.priority) conditions.push(eq(issues.priority, input.priority))
  if (input.assignee === 'unassigned') {
    conditions.push(isNull(issues.assigneeId))
  } else if (input.assignee) {
    conditions.push(eq(issues.assigneeId, input.assignee))
  }
  if (input.q) {
    const pattern = `%${escapeLike(input.q)}%`
    const match = or(
      ilike(issues.title, pattern),
      ilike(issues.description, pattern),
    )
    if (match) conditions.push(match)
  }
  const where = and(...conditions)

  const [items, [totalRow]] = await Promise.all([
    selectIssues(db)
      .where(where)
      .orderBy(desc(issues.updatedAt), desc(issues.id))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
    db.select({ total: count() }).from(issues).where(where),
  ])

  return {
    items,
    total: totalRow?.total ?? 0,
    page: input.page,
    pageSize: input.pageSize,
  }
}

// El assignee debe ser de la misma org que el issue.
async function assertUserInOrg(userId: string, orgId: string) {
  const [found] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, orgId)))
    .limit(1)
  if (!found) {
    throw new AppError('VALIDATION', 'Assignee not found', {
      assigneeId: 'Assignee not found',
    })
  }
}

// Texto vacío se guarda como "sin descripción".
function normalizeDescription(description: string | null | undefined) {
  const trimmed = description?.trim()
  return trimmed ? trimmed : null
}

export async function createIssueForUser(
  user: SessionUser,
  input: CreateIssueInput,
): Promise<IssueDto> {
  // El member siempre crea issues asignados a sí mismo, pida lo que pida.
  const assigneeId =
    user.role === 'member' ? user.id : (input.assigneeId ?? null)

  if (!can(user, 'issue:create', { orgId: user.orgId, assigneeId })) {
    throw new AppError('FORBIDDEN', 'You cannot create this issue')
  }
  if (assigneeId) await assertUserInOrg(assigneeId, user.orgId)

  // Issue y evento "created" se guardan juntos: o quedan los dos o ninguno.
  return db.transaction(async (tx) => {
    const now = new Date()
    const [created] = await tx
      .insert(issues)
      .values({
        orgId: user.orgId,
        title: input.title,
        description: normalizeDescription(input.description),
        status: input.status,
        priority: input.priority,
        assigneeId,
        createdBy: user.id,
        labels: input.labels,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: issues.id })
    if (!created) throw new Error('Issue insert failed')

    await tx.insert(issueEvents).values({
      issueId: created.id,
      orgId: user.orgId,
      actorId: user.id,
      type: 'created',
      createdAt: now,
    })

    return getIssueForUser(user, created.id, tx)
  })
}

// Las etiquetas se guardan en el evento como texto: "bug, ui" (o null si no hay).
function joinLabels(labels: string[]) {
  return labels.length > 0 ? labels.join(', ') : null
}

// Un evento por cada campo de seguimiento que cambió: status, priority, assignee,
// título, descripción y etiquetas.
function buildChangeEvents(
  current: typeof issues.$inferSelect,
  changes: Partial<typeof issues.$inferInsert>,
  actorId: string,
  now: Date,
): (typeof issueEvents.$inferInsert)[] {
  const base = {
    issueId: current.id,
    orgId: current.orgId,
    actorId,
    createdAt: now,
  }
  const events: (typeof issueEvents.$inferInsert)[] = []
  if (changes.status) {
    events.push({
      ...base,
      type: 'status_changed',
      fromValue: current.status,
      toValue: changes.status,
    })
  }
  if (changes.priority) {
    events.push({
      ...base,
      type: 'priority_changed',
      fromValue: current.priority,
      toValue: changes.priority,
    })
  }
  // `in` porque desasignar deja assigneeId en null, que sí es un cambio.
  if ('assigneeId' in changes) {
    events.push({
      ...base,
      type: 'assignee_changed',
      fromValue: current.assigneeId,
      toValue: changes.assigneeId ?? null,
    })
  }
  if (changes.title) {
    events.push({
      ...base,
      type: 'title_changed',
      fromValue: current.title,
      toValue: changes.title,
    })
  }
  if (changes.labels) {
    events.push({
      ...base,
      type: 'labels_changed',
      fromValue: joinLabels(current.labels),
      toValue: joinLabels(changes.labels),
    })
  }
  // De la descripción no se guarda el texto (puede ser larguísimo): solo que cambió.
  if ('description' in changes) {
    events.push({ ...base, type: 'description_changed' })
  }
  return events
}

// Mismas etiquetas aunque vengan en otro orden: reordenarlas no es un cambio.
function sameLabels(a: string[], b: string[]) {
  const sortedB = [...b].sort()
  return (
    a.length === b.length &&
    [...a].sort().every((label, i) => label === sortedB[i])
  )
}

export async function updateIssueForUser(
  user: SessionUser,
  input: UpdateIssueInput,
): Promise<IssueDto> {
  // Transacción + FOR UPDATE: nadie más modifica la fila mientras la evaluamos.
  // El cambio y sus eventos van en la misma transacción. Si algo lanza un
  // error (permiso, validación o fallo al guardar el evento), no se escribe nada.
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(issues)
      .where(and(eq(issues.id, input.id), eq(issues.orgId, user.orgId)))
      .for('update')
    if (!current) throw new AppError('NOT_FOUND', 'Issue not found')

    if (!can(user, 'issue:update', current)) {
      throw new AppError('FORBIDDEN', 'You cannot edit this issue')
    }

    // Solo cuentan los cambios efectivos (valor distinto al actual).
    const changes: Partial<typeof issues.$inferInsert> = {}
    if (input.title !== undefined && input.title !== current.title) {
      changes.title = input.title
    }
    if (input.description !== undefined) {
      const description = normalizeDescription(input.description)
      if (description !== current.description) changes.description = description
    }
    if (input.status !== undefined && input.status !== current.status) {
      changes.status = input.status
    }
    if (input.priority !== undefined && input.priority !== current.priority) {
      changes.priority = input.priority
    }
    if (
      input.labels !== undefined &&
      !sameLabels(input.labels, current.labels)
    ) {
      changes.labels = input.labels
    }
    if (
      input.assigneeId !== undefined &&
      input.assigneeId !== current.assigneeId
    ) {
      if (!can(user, 'issue:assign', current)) {
        throw new AppError('FORBIDDEN', 'You cannot reassign issues')
      }
      if (input.assigneeId) await assertUserInOrg(input.assigneeId, user.orgId)
      changes.assigneeId = input.assigneeId
    }

    if (Object.keys(changes).length > 0) {
      const now = new Date()
      await tx
        .update(issues)
        .set({ ...changes, updatedAt: now })
        .where(eq(issues.id, current.id))

      const events = buildChangeEvents(current, changes, user.id, now)
      if (events.length > 0) await tx.insert(issueEvents).values(events)
    }

    return getIssueForUser(user, current.id, tx)
  })
}

export async function deleteIssueForUser(
  user: SessionUser,
  id: string,
): Promise<{ id: string }> {
  const [issue] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.id, id), eq(issues.orgId, user.orgId)))
    .limit(1)
  if (!issue) throw new AppError('NOT_FOUND', 'Issue not found')

  if (!can(user, 'issue:delete', issue)) {
    throw new AppError('FORBIDDEN', 'You cannot delete this issue')
  }

  // Los comentarios y eventos se borran solos (ON DELETE CASCADE).
  await db.delete(issues).where(eq(issues.id, issue.id))
  return { id: issue.id }
}

export async function listUsersInOrg(user: SessionUser): Promise<OrgUser[]> {
  return db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.orgId, user.orgId))
    .orderBy(users.name)
}

// Historial de un issue, del más antiguo al más nuevo. Solo lectura: no existe
// ninguna función para editar o borrar eventos.
export async function listEventsForIssue(
  user: SessionUser,
  issueId: string,
): Promise<IssueEventDto[]> {
  // Si el issue es de otra org, responde NOT_FOUND igual que getIssue.
  await getIssueForUser(user, issueId)

  const rows = await db
    .select({
      id: issueEvents.id,
      type: issueEvents.type,
      fromValue: issueEvents.fromValue,
      toValue: issueEvents.toValue,
      actorId: issueEvents.actorId,
      actorName: users.name,
      createdAt: issueEvents.createdAt,
    })
    .from(issueEvents)
    .innerJoin(users, eq(users.id, issueEvents.actorId))
    .where(
      and(eq(issueEvents.issueId, issueId), eq(issueEvents.orgId, user.orgId)),
    )
    // Los eventos de un mismo cambio comparten hora; el tipo desempata.
    .orderBy(asc(issueEvents.createdAt), asc(issueEvents.type))

  // En assignee_changed los valores son ids de usuario: se traducen a nombres.
  const assigneeIds = new Set<string>()
  for (const row of rows) {
    if (row.type !== 'assignee_changed') continue
    if (row.fromValue) assigneeIds.add(row.fromValue)
    if (row.toValue) assigneeIds.add(row.toValue)
  }
  const names = new Map<string, string>()
  if (assigneeIds.size > 0) {
    const found = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(
        and(inArray(users.id, [...assigneeIds]), eq(users.orgId, user.orgId)),
      )
    for (const person of found) names.set(person.id, person.name)
  }

  return rows.map((row) => {
    const isAssignee = row.type === 'assignee_changed'
    return {
      ...row,
      fromName:
        isAssignee && row.fromValue ? (names.get(row.fromValue) ?? null) : null,
      toName:
        isAssignee && row.toValue ? (names.get(row.toValue) ?? null) : null,
    }
  })
}
