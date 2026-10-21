import { describe, expect, it } from 'vitest'
import { groupByStatus, statusFromDrop, toBoardInput } from '@/lib/kanban'
import type { IssueDto } from '@/lib/types'

function issue(
  id: string,
  status: IssueDto['status'],
  updated: number,
): IssueDto {
  return {
    id,
    title: id,
    description: null,
    status,
    priority: 'med',
    assigneeId: null,
    assigneeName: null,
    createdBy: 'u1',
    createdByName: 'Alicia',
    labels: [],
    createdAt: new Date(2026, 9, 1),
    updatedAt: new Date(2026, 9, updated),
  }
}

describe('statusFromDrop', () => {
  it('returns the column where the card was dropped', () => {
    expect(statusFromDrop('done', 'todo')).toBe('done')
    expect(statusFromDrop('in_progress', 'done')).toBe('in_progress')
  })

  it('does nothing when dropped on the same column', () => {
    expect(statusFromDrop('todo', 'todo')).toBeNull()
  })

  it('does nothing when dropped outside a column or on something unknown', () => {
    expect(statusFromDrop(undefined, 'todo')).toBeNull()
    expect(statusFromDrop(null, 'todo')).toBeNull()
    expect(statusFromDrop('otra-tarjeta', 'todo')).toBeNull()
  })
})

describe('groupByStatus', () => {
  it('splits the issues by column, newest first', () => {
    const columns = groupByStatus([
      issue('a', 'todo', 1),
      issue('b', 'done', 2),
      issue('c', 'todo', 5),
      issue('d', 'in_progress', 3),
    ])
    expect(columns.todo.map((i) => i.id)).toEqual(['c', 'a'])
    expect(columns.in_progress.map((i) => i.id)).toEqual(['d'])
    expect(columns.done.map((i) => i.id)).toEqual(['b'])
  })

  it('always returns the three columns, even when empty', () => {
    expect(groupByStatus([])).toEqual({ todo: [], in_progress: [], done: [] })
  })
})

describe('toBoardInput', () => {
  it('asks for everything at once: page 1 with the maximum page size, no status', () => {
    const input = toBoardInput({ priority: 'high', q: 'login' })
    expect(input).toMatchObject({
      page: 1,
      pageSize: 100,
      priority: 'high',
      q: 'login',
    })
    expect(input).not.toHaveProperty('status')
  })
})
