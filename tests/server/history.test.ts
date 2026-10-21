// @vitest-environment node
import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { createIssueSchema, updateIssueSchema } from '@/lib/schemas'
import type { SessionUser } from '@/lib/types'

// Usan un Postgres real y aislado (TEST_DATABASE_URL); sin esa variable se omiten.
const hasTestDb = Boolean(process.env.TEST_DATABASE_URL)

type Service = typeof import('@/server/issues/service')
type Db = typeof import('@/db').db
type Fixtures = Awaited<
  ReturnType<typeof import('../helpers/fixtures').resetAndSeedFixtures>
>

describe.skipIf(!hasTestDb)('issue history', () => {
  let svc: Service
  let db: Db
  let f: Fixtures

  beforeEach(async () => {
    svc = await import('@/server/issues/service')
    db = (await import('@/db')).db
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
  const events = (user: SessionUser, issueId: string) =>
    svc.listEventsForIssue(user, issueId)
  const countRows = async (table: 'issues' | 'issue_events') => {
    const rows = await db.execute(
      sql`select count(*)::int as n from ${sql.identifier(table)}`,
    )
    return (rows[0] as { n: number }).n
  }

  // Hace que cualquier insert en issue_events falle, como si el historial se rompiera.
  async function withFailingHistory(run: () => Promise<unknown>) {
    await db.execute(sql`
      create or replace function fail_event_insert() returns trigger as $$
      begin raise exception 'forced history failure'; end;
      $$ language plpgsql`)
    await db.execute(sql`
      create trigger fail_event_insert before insert on issue_events
      for each row execute function fail_event_insert()`)
    try {
      await run()
    } finally {
      await db.execute(
        sql`drop trigger if exists fail_event_insert on issue_events`,
      )
      await db.execute(sql`drop function if exists fail_event_insert()`)
    }
  }

  describe('creation', () => {
    it('stores exactly one "created" event together with the issue', async () => {
      const issue = await create(f.ana, { title: 'Nuevo' })
      const history = await events(f.ana, issue.id)
      expect(history).toHaveLength(1)
      expect(history[0]).toMatchObject({
        type: 'created',
        actorId: f.ana.id,
        actorName: 'Ana',
        fromValue: null,
        toValue: null,
      })
    })

    it('leaves no issue behind when the event cannot be saved (rollback)', async () => {
      await withFailingHistory(async () => {
        await expect(create(f.acmeAdmin)).rejects.toThrow()
      })
      expect(await countRows('issues')).toBe(0)
      expect(await countRows('issue_events')).toBe(0)
    })
  })

  describe('effective changes', () => {
    it('saves the new status and an event with the right from/to and actor', async () => {
      const issue = await create(f.ana)
      const updated = await update(f.ana, {
        id: issue.id,
        status: 'in_progress',
      })
      expect(updated.status).toBe('in_progress')

      const history = await events(f.ana, issue.id)
      expect(history.map((e) => e.type)).toEqual(['created', 'status_changed'])
      expect(history[1]).toMatchObject({
        fromValue: 'todo',
        toValue: 'in_progress',
        actorId: f.ana.id,
      })
      // El evento y el issue comparten el mismo instante.
      expect(history[1]?.createdAt.getTime()).toBe(updated.updatedAt.getTime())
    })

    it('records one event per changed field, with names for assignee changes', async () => {
      const issue = await create(f.acmeAdmin)
      await update(f.acmeAdmin, {
        id: issue.id,
        status: 'done',
        priority: 'high',
        assigneeId: f.luis.id,
      })
      await update(f.acmeAdmin, { id: issue.id, assigneeId: null })

      const history = await events(f.acmeAdmin, issue.id)
      expect(history.map((e) => e.type)).toEqual([
        'created',
        'status_changed',
        'priority_changed',
        'assignee_changed',
        'assignee_changed',
      ])
      const [, status, priority, assigned, unassigned] = history
      expect(status).toMatchObject({ fromValue: 'todo', toValue: 'done' })
      expect(priority).toMatchObject({ fromValue: 'med', toValue: 'high' })
      expect(assigned).toMatchObject({
        fromName: null,
        toName: 'Luis',
        toValue: f.luis.id,
      })
      expect(unassigned).toMatchObject({
        fromName: 'Luis',
        toName: null,
        toValue: null,
      })
    })

    it('records the old and new title when the title changes', async () => {
      const issue = await create(f.ana, { title: 'Título viejo' })
      await update(f.ana, { id: issue.id, title: '  Título nuevo  ' })

      const history = await events(f.ana, issue.id)
      expect(history.map((e) => e.type)).toEqual(['created', 'title_changed'])
      expect(history[1]).toMatchObject({
        fromValue: 'Título viejo',
        toValue: 'Título nuevo',
        actorId: f.ana.id,
      })
    })

    it('records that the description changed, without storing its text', async () => {
      const issue = await create(f.ana, { description: 'versión 1' })
      await update(f.ana, {
        id: issue.id,
        description: 'versión 2, mucho más larga',
      })
      // Vaciarla también cuenta como cambio.
      await update(f.ana, { id: issue.id, description: '   ' })

      const history = await events(f.ana, issue.id)
      expect(history.map((e) => e.type)).toEqual([
        'created',
        'description_changed',
        'description_changed',
      ])
      for (const event of history.slice(1)) {
        expect(event.fromValue).toBeNull()
        expect(event.toValue).toBeNull()
      }
    })

    it('records every tracked change of one edit, in a stable order', async () => {
      const issue = await create(f.acmeAdmin, { title: 'A' })
      await update(f.acmeAdmin, {
        id: issue.id,
        title: 'B',
        description: 'algo',
        status: 'done',
        labels: ['bug'],
      })
      const types = (await events(f.acmeAdmin, issue.id)).map((e) => e.type)
      expect(types).toEqual([
        'created',
        'status_changed',
        'title_changed',
        'description_changed',
        'labels_changed',
      ])
    })

    it('does not create events when the title or description are sent unchanged', async () => {
      const issue = await create(f.ana, {
        title: 'Igual',
        description: 'mismo texto',
      })
      await update(f.ana, {
        id: issue.id,
        title: 'Igual',
        description: 'mismo texto',
      })
      expect(await events(f.ana, issue.id)).toHaveLength(1)
    })

    it('records label changes: adding, replacing and clearing', async () => {
      const issue = await create(f.acmeAdmin)
      await update(f.acmeAdmin, { id: issue.id, labels: ['bug', 'ui'] })
      await update(f.acmeAdmin, { id: issue.id, labels: ['bug'] })
      await update(f.acmeAdmin, { id: issue.id, labels: [] })

      const history = (await events(f.acmeAdmin, issue.id)).slice(1)
      expect(history.map((e) => e.type)).toEqual([
        'labels_changed',
        'labels_changed',
        'labels_changed',
      ])
      expect(history.map((e) => [e.fromValue, e.toValue])).toEqual([
        [null, 'bug, ui'],
        ['bug, ui', 'bug'],
        ['bug', null],
      ])
    })

    it('does not count a different order of the same labels as a change', async () => {
      const issue = await create(f.acmeAdmin, { labels: ['bug', 'ui'] })
      await update(f.acmeAdmin, { id: issue.id, labels: ['ui', 'bug'] })
      expect(await events(f.acmeAdmin, issue.id)).toHaveLength(1)
    })

    it('does not create events when nothing really changes', async () => {
      const issue = await create(f.ana, { priority: 'high' })
      await update(f.ana, {
        id: issue.id,
        status: 'todo',
        priority: 'high',
        title: 'Issue',
      })
      expect(await events(f.ana, issue.id)).toHaveLength(1)
    })

    it('restores the previous state when the event cannot be saved (rollback)', async () => {
      const issue = await create(f.ana)
      const before = await events(f.ana, issue.id)

      await withFailingHistory(async () => {
        await expect(
          update(f.ana, { id: issue.id, status: 'done', title: 'Cambiado' }),
        ).rejects.toThrow()
      })

      const after = await svc.getIssueForUser(f.ana, issue.id)
      expect(after).toMatchObject({ status: 'todo', title: 'Issue' })
      expect(after.updatedAt.getTime()).toBe(issue.updatedAt.getTime())
      expect(await events(f.ana, issue.id)).toEqual(before)
    })
  })

  describe('rejected operations', () => {
    it('write nothing and create no events', async () => {
      const ofLuis = await create(f.luis)
      const ofAna = await create(f.ana)
      const betaIssue = await create(f.betaAdmin)
      const issuesBefore = await countRows('issues')
      const eventsBefore = await countRows('issue_events')

      // Sin permiso, reasignar siendo member, assignee de otra org y otra org.
      const rejected = [
        () => update(f.ana, { id: ofLuis.id, status: 'done' }),
        () =>
          update(f.ana, {
            id: ofAna.id,
            status: 'done',
            assigneeId: f.luis.id,
          }),
        () =>
          update(f.acmeAdmin, {
            id: ofAna.id,
            status: 'done',
            assigneeId: f.bea.id,
          }),
        () => update(f.acmeAdmin, { id: betaIssue.id, status: 'done' }),
        () => svc.deleteIssueForUser(f.ana, ofAna.id),
      ]
      // Una por una: cada intento se evalúa solo cuando le toca.
      for (const attempt of rejected) await expect(attempt()).rejects.toThrow()

      expect(await countRows('issues')).toBe(issuesBefore)
      expect(await countRows('issue_events')).toBe(eventsBefore)
      expect(await svc.getIssueForUser(f.ana, ofAna.id)).toMatchObject({
        status: 'todo',
        assigneeId: f.ana.id,
      })
    })
  })

  describe('reading the history', () => {
    it('answers NOT_FOUND for the history of an issue from another org', async () => {
      const betaIssue = await create(f.betaAdmin)
      await expect(events(f.acmeAdmin, betaIssue.id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
      expect(await events(f.betaAdmin, betaIssue.id)).toHaveLength(1)
    })

    it('is removed together with the issue', async () => {
      const issue = await create(f.ana)
      await update(f.ana, { id: issue.id, status: 'done' })
      await svc.deleteIssueForUser(f.acmeAdmin, issue.id)
      expect(await countRows('issue_events')).toBe(0)
    })
  })
})
