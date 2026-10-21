// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { can } from '@/server/authz'

const admin = { id: 'admin-1', orgId: 'org-a', role: 'admin' } as const
const member = { id: 'member-1', orgId: 'org-a', role: 'member' } as const
const otherMember = { id: 'member-2', orgId: 'org-a', role: 'member' } as const

const assignedToMember = { orgId: 'org-a', assigneeId: 'member-1' }
const assignedToOther = { orgId: 'org-a', assigneeId: 'member-2' }
const unassigned = { orgId: 'org-a', assigneeId: null }
const foreignIssue = { orgId: 'org-b', assigneeId: 'member-1' }

describe('can() on issues', () => {
  it('lets an admin do everything on issues of their org', () => {
    for (const action of [
      'issue:create',
      'issue:update',
      'issue:assign',
      'issue:delete',
    ] as const) {
      expect(can(admin, action, assignedToOther)).toBe(true)
      expect(can(admin, action, unassigned)).toBe(true)
    }
  })

  it('lets a member create and edit only issues assigned to them', () => {
    expect(can(member, 'issue:create', assignedToMember)).toBe(true)
    expect(can(member, 'issue:update', assignedToMember)).toBe(true)
    expect(can(member, 'issue:create', assignedToOther)).toBe(false)
    expect(can(member, 'issue:update', assignedToOther)).toBe(false)
    expect(can(member, 'issue:update', unassigned)).toBe(false)
  })

  it('never lets a member reassign or delete, even their own issue', () => {
    expect(can(member, 'issue:assign', assignedToMember)).toBe(false)
    expect(can(member, 'issue:delete', assignedToMember)).toBe(false)
  })

  it('denies everything on another organization', () => {
    for (const action of [
      'issue:create',
      'issue:update',
      'issue:assign',
      'issue:delete',
      'comment:create',
    ] as const) {
      expect(can(admin, action, foreignIssue)).toBe(false)
    }
  })
})

describe('can() on comments', () => {
  const ownComment = { orgId: 'org-a', authorId: 'member-1' }

  it('lets anyone in the org comment', () => {
    expect(can(member, 'comment:create', unassigned)).toBe(true)
    expect(can(admin, 'comment:create', unassigned)).toBe(true)
  })

  it('lets only the author edit or delete, not even an admin', () => {
    for (const action of ['comment:update', 'comment:delete'] as const) {
      expect(can(member, action, ownComment)).toBe(true)
      expect(can(otherMember, action, ownComment)).toBe(false)
      expect(can(admin, action, ownComment)).toBe(false)
    }
  })
})
