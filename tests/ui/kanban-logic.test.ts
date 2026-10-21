import { describe, expect, it } from 'vitest'
import {
  byPosition,
  dropTarget,
  groupByStatus,
  isBelowMiddle,
  positionForDrop,
  toBoardInput,
} from '@/lib/kanban'
import { fitsBetween, nextPositionAfter, slotBetween } from '@/lib/position'
import type { IssueDto, Status } from '@/lib/types'

function issue(
  id: string,
  status: Status,
  position: number,
  updated = 1,
): IssueDto {
  return {
    id,
    title: id,
    description: null,
    status,
    priority: 'med',
    position,
    assigneeId: null,
    assigneeName: null,
    createdBy: 'u1',
    createdByName: 'Alicia',
    labels: [],
    createdAt: new Date(2026, 9, 1),
    updatedAt: new Date(2026, 9, updated),
  }
}

// todo: a, b, c (de arriba hacia abajo) · in_progress: d · done: (vacía)
const board = () =>
  groupByStatus([
    issue('c', 'todo', 3),
    issue('a', 'todo', 1),
    issue('b', 'todo', 2),
    issue('d', 'in_progress', 1),
  ])
const ids = (list: IssueDto[]) => list.map((i) => i.id)

describe('groupByStatus', () => {
  it('splits the issues by column and sorts each one by position', () => {
    const columns = board()
    expect(ids(columns.todo)).toEqual(['a', 'b', 'c'])
    expect(ids(columns.in_progress)).toEqual(['d'])
    expect(ids(columns.done)).toEqual([])
  })

  it('always returns the three columns, even when empty', () => {
    expect(groupByStatus([])).toEqual({ todo: [], in_progress: [], done: [] })
  })

  it('breaks a tie in position by most recent activity and then by id, always the same way', () => {
    const tied = [
      issue('x', 'todo', 5, 1),
      issue('y', 'todo', 5, 9),
      issue('w', 'todo', 5, 9),
    ]
    expect(ids(groupByStatus(tied).todo)).toEqual(['w', 'y', 'x'])
    expect(ids(groupByStatus([...tied].reverse()).todo)).toEqual([
      'w',
      'y',
      'x',
    ])
    expect(
      byPosition(issue('a', 'todo', 1), issue('b', 'todo', 2)),
    ).toBeLessThan(0)
  })
})

describe('dropTarget', () => {
  it('puts the card below the one it was dropped on, in the lower half', () => {
    expect(dropTarget('b', 'a', board(), true)).toEqual({
      status: 'todo',
      afterId: 'b',
    })
  })

  it('puts the card above the one it was dropped on, in the upper half', () => {
    // «c» sobre «b», arriba de «b»: queda debajo de «a»
    expect(dropTarget('b', 'c', board(), false)).toEqual({
      status: 'todo',
      afterId: 'a',
    })
  })

  it('puts the card at the very top when dropped above the first one', () => {
    expect(dropTarget('a', 'c', board(), false)).toEqual({
      status: 'todo',
      afterId: null,
    })
  })

  it('works across columns, using the neighbours of the target column', () => {
    // «d» (de «En progreso») soltada sobre «a» (de «Por hacer»)
    expect(dropTarget('a', 'd', board(), true)).toEqual({
      status: 'todo',
      afterId: 'a',
    })
    expect(dropTarget('a', 'd', board(), false)).toEqual({
      status: 'todo',
      afterId: null,
    })
    // «a» (de «Por hacer») soltada sobre «d» (de «En progreso»)
    expect(dropTarget('d', 'a', board(), true)).toEqual({
      status: 'in_progress',
      afterId: 'd',
    })
  })

  it('puts the card at the end of a column dropped on the column itself', () => {
    expect(dropTarget('done', 'a', board(), true)).toEqual({
      status: 'done',
      afterId: null,
    })
    expect(dropTarget('in_progress', 'a', board(), true)).toEqual({
      status: 'in_progress',
      afterId: 'd',
    })
    // En su propia columna, «al final» no cuenta a la propia tarjeta.
    expect(dropTarget('todo', 'a', board(), true)).toEqual({
      status: 'todo',
      afterId: 'c',
    })
  })

  it('returns null when nothing would change', () => {
    expect(dropTarget('a', 'a', board(), true)).toBeNull() // sobre sí misma
    expect(dropTarget('b', 'a', board(), false)).toBeNull() // «a» ya está encima de «b»
    expect(dropTarget('a', 'b', board(), true)).toBeNull() // «b» ya está debajo de «a»
  })

  it('returns null for a drop outside of any card or column, or an unknown card', () => {
    expect(dropTarget(undefined, 'a', board(), true)).toBeNull()
    expect(dropTarget('no-existe', 'a', board(), true)).toBeNull()
    expect(dropTarget('b', 'no-existe', board(), true)).toBeNull()
  })
})

describe('isBelowMiddle', () => {
  const over = { top: 100, height: 40 } // centro en 120
  it('compares the center of the dragged card with the center of the other one', () => {
    expect(isBelowMiddle({ top: 110, height: 40 }, over)).toBe(true) // centro 130
    expect(isBelowMiddle({ top: 90, height: 40 }, over)).toBe(false) // centro 110
    expect(isBelowMiddle({ top: 100, height: 40 }, over)).toBe(false) // empate: arriba
  })
})

describe('slotBetween', () => {
  it('averages the two neighbours', () => {
    expect(slotBetween(1, 3)).toBe(2)
    expect(slotBetween(1, 2)).toBe(1.5)
  })

  it('goes just above the first card, just below the last, or to 0 in an empty column', () => {
    expect(slotBetween(null, 5)).toBe(4)
    expect(slotBetween(5, null)).toBe(6)
    expect(slotBetween(null, null)).toBe(0)
  })
})

describe('nextPositionAfter / fitsBetween', () => {
  it('finds the closest greater position, or null for the last one', () => {
    expect(nextPositionAfter([3, 1, 2], 1)).toBe(2)
    expect(nextPositionAfter([3, 1, 2], 3)).toBeNull()
    expect(nextPositionAfter([], 1)).toBeNull()
  })

  it('detects when two positions ran out of decimals', () => {
    expect(fitsBetween(1.5, 1, 2)).toBe(true)
    expect(fitsBetween(1, 1, 2)).toBe(false)
    expect(fitsBetween(2, 1, 2)).toBe(false)
    expect(fitsBetween(10, 1, null)).toBe(true)
    const a = 1
    const b = 1 + Number.EPSILON
    expect(fitsBetween(slotBetween(a, b), a, b)).toBe(false)
  })
})

describe('positionForDrop (what is shown before the server answers)', () => {
  const items = [
    issue('a', 'todo', 1),
    issue('b', 'todo', 2),
    issue('c', 'todo', 3),
    issue('d', 'done', 10),
  ]
  const active = items[0]!

  it('lands between the card it goes below and the next one', () => {
    expect(positionForDrop(items, active, 'todo', 'b')).toBe(2.5)
    expect(positionForDrop(items, active, 'todo', 'c')).toBe(4)
  })

  it('lands on top with no card above, ignoring the card itself', () => {
    expect(positionForDrop(items, active, 'todo', null)).toBe(1) // la más baja de las otras (2) menos 1
    expect(positionForDrop(items, active, 'done', null)).toBe(9)
  })

  it('falls back to the top if the card above is not in that column', () => {
    expect(positionForDrop(items, active, 'done', 'b')).toBe(9)
    expect(positionForDrop(items, active, 'todo', 'zzz')).toBe(1)
  })

  it('uses 0 for an empty column', () => {
    expect(positionForDrop(items, active, 'in_progress', null)).toBe(0)
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
