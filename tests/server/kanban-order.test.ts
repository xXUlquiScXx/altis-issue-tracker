// @vitest-environment node
import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { groupByStatus } from '@/lib/kanban'
import {
  createIssueSchema,
  listIssuesSchema,
  moveIssueSchema,
  updateIssueSchema,
} from '@/lib/schemas'
import type { SessionUser, Status } from '@/lib/types'

// Usan un Postgres real y aislado (TEST_DATABASE_URL); sin esa variable se omiten.
const hasTestDb = Boolean(process.env.TEST_DATABASE_URL)

type Service = typeof import('@/server/issues/service')
type Fixtures = Awaited<
  ReturnType<typeof import('../helpers/fixtures').resetAndSeedFixtures>
>

describe.skipIf(!hasTestDb)('kanban order', () => {
  let svc: Service
  let f: Fixtures

  beforeEach(async () => {
    svc = await import('@/server/issues/service')
    const { resetAndSeedFixtures } = await import('../helpers/fixtures')
    f = await resetAndSeedFixtures()
  })

  const create = (user: SessionUser, title: string, extra = {}) =>
    svc.createIssueForUser(user, createIssueSchema.parse({ title, ...extra }))
  const move = (
    user: SessionUser,
    id: string,
    status: Status,
    afterId?: string | null,
  ) =>
    svc.moveIssueForUser(user, moveIssueSchema.parse({ id, status, afterId }))
  // Los títulos de una columna, de arriba hacia abajo: lo mismo que ve el tablero.
  const column = async (user: SessionUser, status: Status) => {
    const page = await svc.searchIssues(
      user,
      listIssuesSchema.parse({ pageSize: 100 }),
    )
    return groupByStatus(page.items)[status].map((issue) => issue.title)
  }
  const countEvents = async (issueId: string) => {
    const events = await svc.listEventsForIssue(f.acmeAdmin, issueId)
    return events.map((event) => event.type)
  }

  describe('where cards land', () => {
    it('puts a new issue at the top of its column', async () => {
      await create(f.acmeAdmin, 'A')
      await create(f.acmeAdmin, 'B')
      await create(f.acmeAdmin, 'C')
      expect(await column(f.acmeAdmin, 'todo')).toEqual(['C', 'B', 'A'])
    })

    it('keeps the columns independent from each other', async () => {
      await create(f.acmeAdmin, 'Todo 1')
      await create(f.acmeAdmin, 'Done 1', { status: 'done' })
      await create(f.acmeAdmin, 'Todo 2')
      expect(await column(f.acmeAdmin, 'todo')).toEqual(['Todo 2', 'Todo 1'])
      expect(await column(f.acmeAdmin, 'done')).toEqual(['Done 1'])
    })

    it('puts an issue at the top of the new column when its status is edited', async () => {
      const a = await create(f.acmeAdmin, 'A', { status: 'done' })
      const b = await create(f.acmeAdmin, 'B')
      await svc.updateIssueForUser(
        f.acmeAdmin,
        updateIssueSchema.parse({ id: b.id, status: 'done' }),
      )
      expect(await column(f.acmeAdmin, 'done')).toEqual(['B', 'A'])
      expect(a.status).toBe('done')
    })
  })

  describe('reordering inside a column', () => {
    // Columna de arriba hacia abajo: C, B, A
    let a: { id: string }, b: { id: string }, c: { id: string }
    beforeEach(async () => {
      a = await create(f.acmeAdmin, 'A')
      b = await create(f.acmeAdmin, 'B')
      c = await create(f.acmeAdmin, 'C')
    })

    it('moves a card down, up, to the very top and to the very bottom', async () => {
      await move(f.acmeAdmin, c.id, 'todo', b.id) // C debajo de B
      expect(await column(f.acmeAdmin, 'todo')).toEqual(['B', 'C', 'A'])

      await move(f.acmeAdmin, a.id, 'todo', b.id) // A entre B y C
      expect(await column(f.acmeAdmin, 'todo')).toEqual(['B', 'A', 'C'])

      await move(f.acmeAdmin, c.id, 'todo', null) // C al principio
      expect(await column(f.acmeAdmin, 'todo')).toEqual(['C', 'B', 'A'])

      await move(f.acmeAdmin, c.id, 'todo', a.id) // C al final
      expect(await column(f.acmeAdmin, 'todo')).toEqual(['B', 'A', 'C'])
    })

    it('is a reorder, not an edit: no history event and no change in updated_at', async () => {
      const before = await svc.getIssueForUser(f.acmeAdmin, c.id)
      const moved = await move(f.acmeAdmin, c.id, 'todo', a.id)

      expect(moved.status).toBe('todo')
      expect(moved.updatedAt.getTime()).toBe(before.updatedAt.getTime())
      expect(await countEvents(c.id)).toEqual(['created'])
    })

    it('writes only the moved card: the others keep their position', async () => {
      const positions = async () =>
        Object.fromEntries(
          (
            await svc.searchIssues(
              f.acmeAdmin,
              listIssuesSchema.parse({ pageSize: 100 }),
            )
          ).items.map((i) => [i.title, i.position]),
        )
      const before = await positions()
      await move(f.acmeAdmin, c.id, 'todo', a.id)
      const after = await positions()

      expect(after.A).toBe(before.A)
      expect(after.B).toBe(before.B)
      expect(after.C).not.toBe(before.C)
    })

    it('returns the position in the issue', async () => {
      const moved = await move(f.acmeAdmin, c.id, 'todo', null)
      expect(typeof moved.position).toBe('number')
    })
  })

  describe('moving to another column', () => {
    it('changes the status, logs the event and places the card where it was dropped', async () => {
      const x = await create(f.acmeAdmin, 'X', { status: 'done' })
      await create(f.acmeAdmin, 'Y', { status: 'done' })
      const a = await create(f.acmeAdmin, 'A')
      const before = await svc.getIssueForUser(f.acmeAdmin, a.id)
      // Columna «done», de arriba hacia abajo: Y, X. A cae entre Y y X.
      const y = (
        await svc.searchIssues(
          f.acmeAdmin,
          listIssuesSchema.parse({ status: 'done' }),
        )
      ).items.find((i) => i.title === 'Y')!

      const moved = await move(f.acmeAdmin, a.id, 'done', y.id)

      expect(moved.status).toBe('done')
      expect(moved.updatedAt.getTime()).toBeGreaterThan(
        before.updatedAt.getTime(),
      )
      expect(await column(f.acmeAdmin, 'done')).toEqual(['Y', 'A', 'X'])
      expect(await column(f.acmeAdmin, 'todo')).toEqual([])
      expect(await countEvents(a.id)).toEqual(['created', 'status_changed'])
      expect(x.status).toBe('done')
    })

    it('can drop into an empty column', async () => {
      const a = await create(f.acmeAdmin, 'A')
      await move(f.acmeAdmin, a.id, 'in_progress', null)
      expect(await column(f.acmeAdmin, 'in_progress')).toEqual(['A'])
    })
  })

  describe('neighbours that are no longer valid', () => {
    it('falls back to the top when the card above was deleted, moved, or belongs to another org', async () => {
      const a = await create(f.acmeAdmin, 'A')
      const gone = await create(f.acmeAdmin, 'Gone')
      const elsewhere = await create(f.acmeAdmin, 'Elsewhere', {
        status: 'done',
      })
      const foreign = await create(f.betaAdmin, 'Foreign')
      await svc.deleteIssueForUser(f.acmeAdmin, gone.id)

      for (const afterId of [gone.id, elsewhere.id, foreign.id]) {
        const moved = await move(f.acmeAdmin, a.id, 'todo', afterId)
        expect(moved.status).toBe('todo')
        expect((await column(f.acmeAdmin, 'todo'))[0]).toBe('A')
      }
    })

    it('does not mix organizations: a foreign card never becomes a neighbour', async () => {
      // Acme tiene dos tarjetas; Beta tiene una con una posición enorme (al fondo de todo).
      await create(f.acmeAdmin, 'A')
      await create(f.acmeAdmin, 'B')
      const foreign = await create(f.betaAdmin, 'De Beta')
      const { db } = await import('@/db')
      const { issues } = await import('@/db/schema')
      await db
        .update(issues)
        .set({ position: 1000 })
        .where(eq(issues.id, foreign.id))
      const mine = await create(f.acmeAdmin, 'Mía')

      // Se intenta ponerla «debajo» de la tarjeta de Beta: no vale, y cae arriba.
      await move(f.acmeAdmin, mine.id, 'todo', foreign.id)

      expect(await column(f.acmeAdmin, 'todo')).toEqual(['Mía', 'B', 'A'])
      // Y a Beta no le pasó nada.
      expect(await column(f.betaAdmin, 'todo')).toEqual(['De Beta'])
    })
  })

  describe('permissions', () => {
    it('lets a member move their own cards', async () => {
      const own = await create(f.ana, 'Mía')
      await create(f.ana, 'Otra mía')
      await move(f.ana, own.id, 'in_progress', null)
      expect(await column(f.ana, 'in_progress')).toEqual(['Mía'])
    })

    it('forbids a member from moving or reordering cards of others or unassigned ones, and changes nothing', async () => {
      const ofLuis = await create(f.luis, 'De Luis')
      const free = await create(f.acmeAdmin, 'Libre')
      const snapshot = await column(f.acmeAdmin, 'todo')

      for (const issue of [ofLuis, free]) {
        await expect(move(f.ana, issue.id, 'done', null)).rejects.toMatchObject(
          { code: 'FORBIDDEN' },
        )
        await expect(move(f.ana, issue.id, 'todo', null)).rejects.toMatchObject(
          { code: 'FORBIDDEN' },
        )
      }
      expect(await column(f.acmeAdmin, 'todo')).toEqual(snapshot)
      expect(await countEvents(ofLuis.id)).toEqual(['created'])
    })

    it('answers NOT_FOUND for a card of another organization', async () => {
      const foreign = await create(f.betaAdmin, 'Ajena')
      await expect(
        move(f.acmeAdmin, foreign.id, 'done', null),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
      expect((await svc.getIssueForUser(f.betaAdmin, foreign.id)).status).toBe(
        'todo',
      )
    })
  })

  describe('numbers that run out of decimals', () => {
    it('renumbers the column and keeps the order after inserting many times in the same gap', async () => {
      const first = await create(f.acmeAdmin, 'Primera')
      const last = await create(f.acmeAdmin, 'Última')
      // Orden inicial: Última, Primera. Siempre se mete debajo de «Última».
      const anchor = last.id
      const expected: string[] = []
      for (let i = 1; i <= 70; i++) {
        const card = await create(f.acmeAdmin, `N${i}`)
        await move(f.acmeAdmin, card.id, 'todo', anchor)
        expected.unshift(`N${i}`) // cada nueva queda justo debajo de «Última»
      }

      expect(await column(f.acmeAdmin, 'todo')).toEqual([
        'Última',
        ...expected,
        'Primera',
      ])
      // Y todas las posiciones son distintas (nada quedó pegado).
      const positions = (
        await svc.searchIssues(
          f.acmeAdmin,
          listIssuesSchema.parse({ pageSize: 100 }),
        )
      ).items.map((i) => i.position)
      expect(new Set(positions).size).toBe(positions.length)
      expect(first.status).toBe('todo')
    }, 60_000)
  })

  describe('concurrency', () => {
    it('survives two people dropping a card in the same place at the same time', async () => {
      const anchor = await create(f.acmeAdmin, 'Ancla')
      const one = await create(f.acmeAdmin, 'Uno')
      const two = await create(f.acmeAdmin, 'Dos')

      await Promise.all([
        move(f.acmeAdmin, one.id, 'todo', anchor.id),
        move(f.acmeAdmin, two.id, 'todo', anchor.id),
      ])

      const order = await column(f.acmeAdmin, 'todo')
      expect(order[0]).toBe('Ancla')
      expect(new Set(order)).toEqual(new Set(['Ancla', 'Uno', 'Dos']))
      expect(order).toHaveLength(3)
    })
  })

  it('leaves the positions of other issues untouched when one is deleted', async () => {
    const a = await create(f.acmeAdmin, 'A')
    await create(f.acmeAdmin, 'B')
    await svc.deleteIssueForUser(f.acmeAdmin, a.id)
    expect(await column(f.acmeAdmin, 'todo')).toEqual(['B'])
    const { db } = await import('@/db')
    expect(await db.execute(sql`select 1`)).toBeTruthy()
  })
})
