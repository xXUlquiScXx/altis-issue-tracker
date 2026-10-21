// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createCommentSchema,
  createIssueSchema,
  updateCommentSchema,
} from '@/lib/schemas'
import type { SessionUser } from '@/lib/types'

// Usan un Postgres real y aislado (TEST_DATABASE_URL); sin esa variable se omiten.
const hasTestDb = Boolean(process.env.TEST_DATABASE_URL)

type Comments = typeof import('@/server/comments/service')
type Issues = typeof import('@/server/issues/service')
type Fixtures = Awaited<
  ReturnType<typeof import('../helpers/fixtures').resetAndSeedFixtures>
>

describe.skipIf(!hasTestDb)('comments', () => {
  let comments: Comments
  let issues: Issues
  let f: Fixtures

  beforeEach(async () => {
    comments = await import('@/server/comments/service')
    issues = await import('@/server/issues/service')
    const { resetAndSeedFixtures } = await import('../helpers/fixtures')
    f = await resetAndSeedFixtures()
  })

  const createIssue = (user: SessionUser, input = {}) =>
    issues.createIssueForUser(
      user,
      createIssueSchema.parse({ title: 'Issue', ...input }),
    )
  const comment = (user: SessionUser, issueId: string, body = 'Hola') =>
    comments.createCommentForUser(
      user,
      createCommentSchema.parse({ issueId, body }),
    )
  const edit = (user: SessionUser, id: string, body: string) =>
    comments.updateCommentForUser(user, updateCommentSchema.parse({ id, body }))
  const expectCode = (promise: Promise<unknown>, code: string) =>
    expect(promise).rejects.toMatchObject({ code })

  describe('creating and listing', () => {
    it('lets any user of the org comment on any issue of the org', async () => {
      const ofLuis = await createIssue(f.luis)

      const byAna = await comment(f.ana, ofLuis.id, '  Lo reviso  ')
      const byAdmin = await comment(f.acmeAdmin, ofLuis.id, 'Gracias')

      expect(byAna).toMatchObject({
        body: 'Lo reviso',
        authorId: f.ana.id,
        authorName: 'Ana',
      })
      expect(byAdmin.authorName).toBe('Alicia')
    })

    it('lists the comments of an issue in chronological order with author names', async () => {
      const issue = await createIssue(f.ana)
      await comment(f.ana, issue.id, 'primero')
      await comment(f.luis, issue.id, 'segundo')
      await comment(f.acmeAdmin, issue.id, 'tercero')

      const list = await comments.listCommentsForIssue(f.ana, issue.id)
      expect(list.map((c) => [c.body, c.authorName])).toEqual([
        ['primero', 'Ana'],
        ['segundo', 'Luis'],
        ['tercero', 'Alicia'],
      ])
    })

    it('only lists the comments of the requested issue', async () => {
      const a = await createIssue(f.ana)
      const b = await createIssue(f.ana)
      await comment(f.ana, a.id, 'en A')
      await comment(f.ana, b.id, 'en B')
      const list = await comments.listCommentsForIssue(f.ana, a.id)
      expect(list.map((c) => c.body)).toEqual(['en A'])
    })

    it('rejects a blank comment at validation', () => {
      const blank = {
        issueId: '11111111-1111-4111-8111-111111111111',
        body: '   ',
      }
      expect(createCommentSchema.safeParse(blank).success).toBe(false)
    })

    it('does not touch the issue or its history', async () => {
      const issue = await createIssue(f.ana)
      await comment(f.luis, issue.id)

      const after = await issues.getIssueForUser(f.ana, issue.id)
      expect(after.updatedAt.getTime()).toBe(issue.updatedAt.getTime())
      const history = await issues.listEventsForIssue(f.ana, issue.id)
      expect(history.map((e) => e.type)).toEqual(['created'])
    })
  })

  describe('organization isolation', () => {
    it('answers NOT_FOUND for the issue of another org, when listing and commenting', async () => {
      const betaIssue = await createIssue(f.betaAdmin)
      await comment(f.betaAdmin, betaIssue.id, 'privado de Beta')

      await expectCode(
        comments.listCommentsForIssue(f.acmeAdmin, betaIssue.id),
        'NOT_FOUND',
      )
      await expectCode(comment(f.acmeAdmin, betaIssue.id), 'NOT_FOUND')
      expect(
        await comments.listCommentsForIssue(f.betaAdmin, betaIssue.id),
      ).toHaveLength(1)
    })

    it('answers NOT_FOUND when editing or deleting a comment of another org by its id', async () => {
      const betaIssue = await createIssue(f.betaAdmin)
      const betaComment = await comment(f.betaAdmin, betaIssue.id, 'original')

      await expectCode(edit(f.acmeAdmin, betaComment.id, 'hack'), 'NOT_FOUND')
      await expectCode(
        comments.deleteCommentForUser(f.acmeAdmin, betaComment.id),
        'NOT_FOUND',
      )

      const intact = await comments.listCommentsForIssue(
        f.betaAdmin,
        betaIssue.id,
      )
      expect(intact.map((c) => c.body)).toEqual(['original'])
    })
  })

  describe('only the author can edit or delete', () => {
    it('lets the author edit and marks the comment as edited', async () => {
      const issue = await createIssue(f.ana)
      const original = await comment(f.ana, issue.id, 'v1')

      const edited = await edit(f.ana, original.id, 'v2')
      expect(edited.body).toBe('v2')
      expect(edited.updatedAt.getTime()).toBeGreaterThan(
        original.updatedAt.getTime(),
      )
      expect(edited.createdAt.getTime()).toBe(original.createdAt.getTime())
    })

    it('does not mark as edited when the text is the same', async () => {
      const issue = await createIssue(f.ana)
      const original = await comment(f.ana, issue.id, 'igual')
      const same = await edit(f.ana, original.id, 'igual')
      expect(same.updatedAt.getTime()).toBe(original.updatedAt.getTime())
    })

    it('forbids other members and even an admin from editing or deleting', async () => {
      const issue = await createIssue(f.ana)
      const original = await comment(f.ana, issue.id, 'de Ana')

      for (const other of [f.luis, f.acmeAdmin]) {
        await expectCode(edit(other, original.id, 'cambiado'), 'FORBIDDEN')
        await expectCode(
          comments.deleteCommentForUser(other, original.id),
          'FORBIDDEN',
        )
      }
      const list = await comments.listCommentsForIssue(f.ana, issue.id)
      expect(list.map((c) => c.body)).toEqual(['de Ana'])
    })

    it('lets the author delete their own comment', async () => {
      const issue = await createIssue(f.ana)
      const original = await comment(f.ana, issue.id)
      await comments.deleteCommentForUser(f.ana, original.id)
      expect(await comments.listCommentsForIssue(f.ana, issue.id)).toHaveLength(
        0,
      )
    })

    it('lets an admin edit their own comment', async () => {
      const issue = await createIssue(f.ana)
      const mine = await comment(f.acmeAdmin, issue.id, 'mío')
      expect((await edit(f.acmeAdmin, mine.id, 'mío editado')).body).toBe(
        'mío editado',
      )
    })
  })
})
