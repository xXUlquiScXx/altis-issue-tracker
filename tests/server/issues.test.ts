// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createIssueSchema,
  listIssuesSchema,
  updateIssueSchema,
} from '@/lib/schemas'
import type { SessionUser } from '@/lib/types'

// Estos tests usan un Postgres real y aislado (TEST_DATABASE_URL).
// Sin esa variable se omiten: nunca tocan la base de producción.
const hasTestDb = Boolean(process.env.TEST_DATABASE_URL)

type Service = typeof import('@/server/issues/service')
type Fixtures = Awaited<
  ReturnType<typeof import('../helpers/fixtures').resetAndSeedFixtures>
>

describe.skipIf(!hasTestDb)('issues service', () => {
  let svc: Service
  let f: Fixtures

  beforeEach(async () => {
    svc = await import('@/server/issues/service')
    const { resetAndSeedFixtures } = await import('../helpers/fixtures')
    f = await resetAndSeedFixtures()
  })

  const create = (user: SessionUser, input: Record<string, unknown> = {}) =>
    svc.createIssueForUser(
      user,
      createIssueSchema.parse({ title: 'Issue', ...input }),
    )
  const update = (user: SessionUser, input: Record<string, unknown>) =>
    svc.updateIssueForUser(user, updateIssueSchema.parse(input))
  const list = (user: SessionUser, input: Record<string, unknown> = {}) =>
    svc.searchIssues(user, listIssuesSchema.parse(input))
  const expectCode = (promise: Promise<unknown>, code: string) =>
    expect(promise).rejects.toMatchObject({ code })

  describe('organization isolation', () => {
    it('answers NOT_FOUND for an issue of another org, for every operation', async () => {
      const betaIssue = await create(f.betaAdmin)

      await expectCode(
        svc.getIssueForUser(f.acmeAdmin, betaIssue.id),
        'NOT_FOUND',
      )
      await expectCode(
        update(f.acmeAdmin, { id: betaIssue.id, title: 'x' }),
        'NOT_FOUND',
      )
      await expectCode(
        svc.deleteIssueForUser(f.acmeAdmin, betaIssue.id),
        'NOT_FOUND',
      )
      // Sigue intacto para su dueño.
      expect((await svc.getIssueForUser(f.betaAdmin, betaIssue.id)).title).toBe(
        'Issue',
      )
    })

    it('never lists issues or users of another org', async () => {
      await create(f.betaAdmin, { title: 'Secret of Beta' })
      await create(f.acmeAdmin, { title: 'Of Acme' })

      const page = await list(f.acmeAdmin)
      expect(page.items.map((i) => i.title)).toEqual(['Of Acme'])
      expect(page.total).toBe(1)

      const users = await svc.listUsersInOrg(f.acmeAdmin)
      expect(users.map((u) => u.name).sort()).toEqual(['Alicia', 'Ana', 'Luis'])
    })

    it('rejects an assignee from another org', async () => {
      await expectCode(
        create(f.acmeAdmin, { assigneeId: f.bea.id }),
        'VALIDATION',
      )
      const issue = await create(f.acmeAdmin)
      await expectCode(
        update(f.acmeAdmin, { id: issue.id, assigneeId: f.bea.id }),
        'VALIDATION',
      )
    })
  })

  describe('create', () => {
    it('applies defaults, trims the title and removes repeated labels', async () => {
      const issue = await create(f.acmeAdmin, {
        title: '  Hola  ',
        labels: ['bug', ' bug ', 'ui'],
      })
      expect(issue).toMatchObject({
        title: 'Hola',
        status: 'todo',
        priority: 'med',
        labels: ['bug', 'ui'],
        assigneeId: null,
        createdBy: f.acmeAdmin.id,
      })
    })

    it('rejects a blank title at validation', () => {
      expect(createIssueSchema.safeParse({ title: '   ' }).success).toBe(false)
    })

    it('forces a member to be the assignee, whatever they ask for', async () => {
      const unassigned = await create(f.ana)
      const forOther = await create(f.ana, { assigneeId: f.luis.id })
      expect(unassigned.assigneeId).toBe(f.ana.id)
      expect(forOther.assigneeId).toBe(f.ana.id)
    })

    it('lets an admin assign to anyone in the org or leave it unassigned', async () => {
      const assigned = await create(f.acmeAdmin, { assigneeId: f.luis.id })
      expect(assigned).toMatchObject({
        assigneeId: f.luis.id,
        assigneeName: 'Luis',
      })
    })
  })

  describe('update', () => {
    it('lets a member edit status, priority and title of their own issue', async () => {
      const issue = await create(f.ana)
      const updated = await update(f.ana, {
        id: issue.id,
        title: 'Nuevo',
        status: 'in_progress',
        priority: 'high',
      })
      expect(updated).toMatchObject({
        title: 'Nuevo',
        status: 'in_progress',
        priority: 'high',
      })
    })

    it('forbids a member from editing issues of others or unassigned ones', async () => {
      const ofLuis = await create(f.luis)
      const unassigned = await create(f.acmeAdmin)
      await expectCode(
        update(f.ana, { id: ofLuis.id, status: 'done' }),
        'FORBIDDEN',
      )
      await expectCode(
        update(f.ana, { id: unassigned.id, status: 'done' }),
        'FORBIDDEN',
      )
    })

    it('forbids a member from reassigning and applies nothing from that request', async () => {
      const issue = await create(f.ana)
      await expectCode(
        update(f.ana, { id: issue.id, status: 'done', assigneeId: f.luis.id }),
        'FORBIDDEN',
      )
      const after = await svc.getIssueForUser(f.ana, issue.id)
      expect(after).toMatchObject({ status: 'todo', assigneeId: f.ana.id })
    })

    it('lets an admin reassign and unassign', async () => {
      const issue = await create(f.acmeAdmin)
      const toLuis = await update(f.acmeAdmin, {
        id: issue.id,
        assigneeId: f.luis.id,
      })
      expect(toLuis.assigneeId).toBe(f.luis.id)
      const unassigned = await update(f.acmeAdmin, {
        id: issue.id,
        assigneeId: null,
      })
      expect(unassigned.assigneeId).toBeNull()
    })

    it('stores an empty description as null', async () => {
      const issue = await create(f.acmeAdmin, { description: 'algo' })
      const updated = await update(f.acmeAdmin, {
        id: issue.id,
        description: '   ',
      })
      expect(updated.description).toBeNull()
    })

    it('moves updatedAt only when something really changed', async () => {
      const issue = await create(f.acmeAdmin, { title: 'Igual' })

      const noChange = await update(f.acmeAdmin, {
        id: issue.id,
        title: 'Igual',
        status: 'todo',
      })
      expect(noChange.updatedAt.getTime()).toBe(issue.updatedAt.getTime())

      const changed = await update(f.acmeAdmin, {
        id: issue.id,
        status: 'done',
      })
      expect(changed.updatedAt.getTime()).toBeGreaterThan(
        issue.updatedAt.getTime(),
      )
    })
  })

  describe('delete', () => {
    it('forbids a member, even on their own issue', async () => {
      const issue = await create(f.ana)
      await expectCode(svc.deleteIssueForUser(f.ana, issue.id), 'FORBIDDEN')
      await expect(svc.getIssueForUser(f.ana, issue.id)).resolves.toBeDefined()
    })

    it('lets an admin delete and removes comments and events with it', async () => {
      const issue = await create(f.ana)
      const { db } = await import('@/db')
      const { comments, issueEvents } = await import('@/db/schema')
      await db.insert(comments).values({
        issueId: issue.id,
        orgId: f.ana.orgId,
        authorId: f.ana.id,
        body: 'hola',
      })
      await db.insert(issueEvents).values({
        issueId: issue.id,
        orgId: f.ana.orgId,
        actorId: f.ana.id,
        type: 'created',
      })

      await svc.deleteIssueForUser(f.acmeAdmin, issue.id)

      await expectCode(svc.getIssueForUser(f.acmeAdmin, issue.id), 'NOT_FOUND')
      expect(await db.select().from(comments)).toHaveLength(0)
      expect(await db.select().from(issueEvents)).toHaveLength(0)
    })
  })

  describe('list', () => {
    beforeEach(async () => {
      await create(f.ana, { title: 'Login roto', priority: 'low' })
      await create(f.luis, {
        title: 'Dashboard lento',
        status: 'in_progress',
        priority: 'high',
      })
      await create(f.acmeAdmin, { title: 'Exportar CSV', status: 'done' })
      await create(f.acmeAdmin, { title: 'Subir al 100% done' })
      await create(f.acmeAdmin, {
        title: 'snake_case',
        description: 'Contiene Texto Escondido',
      })
    })

    it('paginates and reports the total', async () => {
      const first = await list(f.acmeAdmin, { page: 1, pageSize: 2 })
      const third = await list(f.acmeAdmin, { page: 3, pageSize: 2 })
      expect(first.items).toHaveLength(2)
      expect(third.items).toHaveLength(1)
      expect(first).toMatchObject({ total: 5, page: 1, pageSize: 2 })
    })

    it('rejects an out-of-range page size', () => {
      expect(listIssuesSchema.safeParse({ pageSize: 101 }).success).toBe(false)
      expect(listIssuesSchema.safeParse({ page: 0 }).success).toBe(false)
    })

    it('orders by most recently updated first', async () => {
      const all = await list(f.acmeAdmin)
      const oldest = all.items.at(-1)!
      await update(f.acmeAdmin, { id: oldest.id, status: 'done' })
      expect((await list(f.acmeAdmin)).items[0]?.id).toBe(oldest.id)
    })

    it('filters by status, priority and assignee, alone or combined', async () => {
      const titles = async (filters: Record<string, unknown>) =>
        (await list(f.acmeAdmin, filters)).items.map((i) => i.title).sort()

      expect(await titles({ status: 'done' })).toEqual(['Exportar CSV'])
      expect(await titles({ priority: 'high' })).toEqual(['Dashboard lento'])
      expect(await titles({ assignee: f.ana.id })).toEqual(['Login roto'])
      expect(await titles({ assignee: 'unassigned' })).toHaveLength(3)
      expect(
        await titles({ status: 'in_progress', assignee: f.luis.id }),
      ).toEqual(['Dashboard lento'])
      expect(await titles({ status: 'done', assignee: f.ana.id })).toEqual([])
    })

    it('searches title and description ignoring case', async () => {
      const titles = async (q: string) =>
        (await list(f.acmeAdmin, { q })).items.map((i) => i.title)

      expect(await titles('LOGIN')).toEqual(['Login roto'])
      expect(await titles('texto escondido')).toEqual(['snake_case'])
    })

    it('treats % and _ as plain text, not as wildcards', async () => {
      const titles = async (q: string) =>
        (await list(f.acmeAdmin, { q })).items.map((i) => i.title)

      expect(await titles('%')).toEqual(['Subir al 100% done'])
      expect(await titles('_')).toEqual(['snake_case'])
    })

    it('includes the assignee name in each item', async () => {
      const page = await list(f.acmeAdmin, { assignee: f.ana.id })
      expect(page.items[0]).toMatchObject({
        assigneeName: 'Ana',
        createdByName: 'Ana',
      })
    })
  })
})
