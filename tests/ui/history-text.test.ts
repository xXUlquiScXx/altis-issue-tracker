import { describe, expect, it } from 'vitest'
import { describeEvent } from '@/lib/history'
import type { IssueEventDto } from '@/lib/types'

function event(patch: Partial<IssueEventDto>): IssueEventDto {
  return {
    id: 'e1',
    type: 'created',
    fromValue: null,
    toValue: null,
    fromName: null,
    toName: null,
    actorId: 'u1',
    actorName: 'Ana',
    createdAt: new Date(2026, 9, 1),
    ...patch,
  }
}

describe('describeEvent', () => {
  it('describes the creation', () => {
    expect(describeEvent(event({ type: 'created' }))).toBe('creó el issue')
  })

  it('translates status and priority values to Spanish', () => {
    expect(
      describeEvent(
        event({
          type: 'status_changed',
          fromValue: 'todo',
          toValue: 'in_progress',
        }),
      ),
    ).toBe('cambió el estado de «Por hacer» a «En progreso»')
    expect(
      describeEvent(
        event({ type: 'priority_changed', fromValue: 'med', toValue: 'high' }),
      ),
    ).toBe('cambió la prioridad de «Media» a «Alta»')
  })

  it('describes title and description changes', () => {
    expect(
      describeEvent(
        event({ type: 'title_changed', fromValue: 'Viejo', toValue: 'Nuevo' }),
      ),
    ).toBe('cambió el título de «Viejo» a «Nuevo»')
    expect(describeEvent(event({ type: 'description_changed' }))).toBe(
      'cambió la descripción',
    )
  })

  it('describes adding, replacing and clearing labels', () => {
    expect(
      describeEvent(
        event({ type: 'labels_changed', fromValue: null, toValue: 'bug, ui' }),
      ),
    ).toBe('agregó las etiquetas «bug, ui»')
    expect(
      describeEvent(
        event({ type: 'labels_changed', fromValue: 'bug, ui', toValue: 'bug' }),
      ),
    ).toBe('cambió las etiquetas de «bug, ui» a «bug»')
    expect(
      describeEvent(
        event({ type: 'labels_changed', fromValue: 'bug', toValue: null }),
      ),
    ).toBe('quitó todas las etiquetas')
  })

  it('describes assigning, unassigning and reassigning with names', () => {
    expect(
      describeEvent(
        event({
          type: 'assignee_changed',
          fromValue: null,
          toValue: 'u2',
          toName: 'Luis',
        }),
      ),
    ).toBe('asignó el issue a Luis')
    expect(
      describeEvent(
        event({
          type: 'assignee_changed',
          fromValue: 'u2',
          fromName: 'Luis',
          toValue: null,
        }),
      ),
    ).toBe('quitó la asignación de Luis')
    expect(
      describeEvent(
        event({
          type: 'assignee_changed',
          fromValue: 'u2',
          fromName: 'Luis',
          toValue: 'u3',
          toName: 'Ana',
        }),
      ),
    ).toBe('cambió el responsable de Luis a Ana')
  })

  it('does not break when a person is no longer available', () => {
    expect(
      describeEvent(
        event({
          type: 'assignee_changed',
          fromValue: 'gone',
          fromName: null,
          toValue: 'u3',
          toName: 'Ana',
        }),
      ),
    ).toBe('cambió el responsable de otra persona a Ana')
  })

  it('shows an unknown value as it comes', () => {
    expect(
      describeEvent(
        event({
          type: 'status_changed',
          fromValue: 'todo',
          toValue: 'blocked',
        }),
      ),
    ).toBe('cambió el estado de «Por hacer» a «blocked»')
  })
})
