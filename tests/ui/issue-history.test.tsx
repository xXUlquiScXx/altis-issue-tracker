import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IssueHistory } from '@/components/issues/issue-history'
import { formatDateTime } from '@/lib/format'
import type { IssueEventDto } from '@/lib/types'

vi.mock('@/server/issues/functions', () => ({ listIssueEvents: vi.fn() }))
const { listIssueEvents } = vi.mocked(await import('@/server/issues/functions'))

const when = new Date(2026, 9, 1, 15, 5)
const events: IssueEventDto[] = [
  {
    id: 'e1',
    type: 'created',
    fromValue: null,
    toValue: null,
    fromName: null,
    toName: null,
    actorId: 'u1',
    actorName: 'Alicia',
    createdAt: when,
  },
  {
    id: 'e2',
    type: 'status_changed',
    fromValue: 'todo',
    toValue: 'in_progress',
    fromName: null,
    toName: null,
    actorId: 'u2',
    actorName: 'Ana',
    createdAt: new Date(2026, 9, 2),
  },
  {
    id: 'e3',
    type: 'assignee_changed',
    fromValue: null,
    toValue: 'u3',
    fromName: null,
    toName: 'Luis',
    actorId: 'u1',
    actorName: 'Alicia',
    createdAt: new Date(2026, 9, 3),
  },
]

function renderHistory() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <IssueHistory issueId="i-1" />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('IssueHistory', () => {
  it('shows a loading state and then the events in chronological order', async () => {
    listIssueEvents.mockResolvedValue(events)
    renderHistory()
    expect(screen.getByLabelText('Cargando historial')).toBeTruthy()

    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]!.textContent).toContain('Alicia creó el issue')
    expect(items[1]!.textContent).toContain(
      'Ana cambió el estado de «Por hacer» a «En progreso»',
    )
    expect(items[2]!.textContent).toContain('Alicia asignó el issue a Luis')
    expect(within(items[0]!).getByText(formatDateTime(when))).toBeTruthy()
    expect(listIssueEvents).toHaveBeenCalledWith({ data: { id: 'i-1' } })
  })

  it('shows an empty state when there is no history', async () => {
    listIssueEvents.mockResolvedValue([])
    renderHistory()
    expect(
      await screen.findByText('Este issue todavía no tiene historial.'),
    ).toBeTruthy()
  })

  it('shows an error with a retry button when the server fails', async () => {
    const user = userEvent.setup()
    listIssueEvents.mockRejectedValueOnce(
      Response.json(
        { error: { code: 'INTERNAL', message: 'Internal server error' } },
        { status: 500 },
      ),
    )
    listIssueEvents.mockResolvedValue(events)
    renderHistory()

    const alert = await screen.findByRole('alert')
    expect(
      within(alert).getByText('No se pudo cargar el historial'),
    ).toBeTruthy()
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))
    const items = await screen.findAllByRole('listitem')
    expect(items[0]!.textContent).toContain('Alicia creó el issue')
  })

  it('is read-only: it has no buttons to edit or delete events', async () => {
    listIssueEvents.mockResolvedValue(events)
    renderHistory()
    await screen.findAllByRole('listitem')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
