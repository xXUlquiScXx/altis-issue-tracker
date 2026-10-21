import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IssueDetailPage } from '@/components/issues/issue-detail-page'
import type { IssueDto, SessionUser } from '@/lib/types'

vi.mock('@/server/issues/functions', () => ({
  getIssue: vi.fn(),
  listOrgUsers: vi.fn(),
  createIssue: vi.fn(),
  updateIssue: vi.fn(),
  deleteIssue: vi.fn(),
}))
const fns = await import('@/server/issues/functions')
const getIssue = vi.mocked(fns.getIssue)
const listOrgUsers = vi.mocked(fns.listOrgUsers)

const ORG = 'org-1'
const admin: SessionUser = {
  id: 'u-admin',
  orgId: ORG,
  orgName: 'Acme',
  role: 'admin',
  name: 'Alicia',
  email: 'a@a.test',
}
const ana: SessionUser = {
  id: 'u-ana',
  orgId: ORG,
  orgName: 'Acme',
  role: 'member',
  name: 'Ana',
  email: 'ana@a.test',
}

function makeIssue(patch: Partial<IssueDto> = {}): IssueDto {
  return {
    id: 'i-1',
    title: 'Error al guardar',
    description: '## Pasos\n\n1. Abrir\n2. **Guardar**',
    status: 'in_progress',
    priority: 'high',
    assigneeId: null,
    assigneeName: null,
    createdBy: admin.id,
    createdByName: 'Alicia',
    labels: ['bug', 'ui'],
    createdAt: new Date(2026, 9, 1, 15, 5),
    updatedAt: new Date(2026, 9, 2, 9, 30),
    ...patch,
  }
}

const onBack = vi.fn()

function renderPage(user: SessionUser = ana) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <IssueDetailPage issueId="i-1" user={user} onBack={onBack} />
    </QueryClientProvider>,
  )
}

const errorResponse = (code: string, message: string, status: number) =>
  Response.json({ error: { code, message } }, { status })

beforeEach(() => {
  listOrgUsers.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('issue detail page', () => {
  it('shows a loading state and then the issue with all its data', async () => {
    getIssue.mockResolvedValue(makeIssue())
    renderPage()
    expect(screen.getByLabelText('Cargando issue')).toBeTruthy()

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Error al guardar',
      }),
    ).toBeTruthy()
    expect(getIssue).toHaveBeenCalledWith({ data: { id: 'i-1' } })
    expect(screen.getByText('En progreso')).toBeTruthy()
    expect(screen.getByText('Alta')).toBeTruthy()
    expect(screen.getByText('Sin asignar')).toBeTruthy()
    expect(screen.getByText('Alicia')).toBeTruthy()
    expect(screen.getByText('bug')).toBeTruthy()
    expect(screen.getByText('ui')).toBeTruthy()
  })

  it('renders the description as Markdown', async () => {
    getIssue.mockResolvedValue(makeIssue())
    const { container } = renderPage()
    expect(await screen.findByRole('heading', { name: 'Pasos' })).toBeTruthy()
    expect(container.querySelector('strong')?.textContent).toBe('Guardar')
  })

  it('shows placeholders when there is no description or labels', async () => {
    getIssue.mockResolvedValue(makeIssue({ description: null, labels: [] }))
    renderPage()
    expect(await screen.findByText('Sin descripción.')).toBeTruthy()
    expect(screen.getByText('Sin etiquetas')).toBeTruthy()
  })

  it('is read-only for a member when the issue is not assigned to them', async () => {
    getIssue.mockResolvedValue(
      makeIssue({ assigneeId: 'u-luis', assigneeName: 'Luis' }),
    )
    renderPage(ana)
    await screen.findByText('Error al guardar')
    expect(screen.getByText('Luis')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull()
  })

  it('lets a member edit their own issue, and an admin edit any', async () => {
    getIssue.mockResolvedValue(
      makeIssue({ assigneeId: ana.id, assigneeName: 'Ana' }),
    )
    renderPage(ana)
    expect(await screen.findByRole('button', { name: /Editar/ })).toBeTruthy()
    cleanup()

    getIssue.mockResolvedValue(makeIssue())
    renderPage(admin)
    expect(await screen.findByRole('button', { name: /Editar/ })).toBeTruthy()
  })

  it('opens the edit form with the issue data', async () => {
    const user = userEvent.setup()
    getIssue.mockResolvedValue(makeIssue())
    renderPage(admin)

    await user.click(await screen.findByRole('button', { name: /Editar/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Editar issue')).toBeTruthy()
    expect(
      (within(dialog).getByLabelText('Título') as HTMLInputElement).value,
    ).toBe('Error al guardar')
  })

  it('goes back when the user presses "Volver"', async () => {
    const user = userEvent.setup()
    getIssue.mockResolvedValue(makeIssue())
    renderPage()
    await screen.findByText('Error al guardar')

    await user.click(screen.getByRole('button', { name: 'Volver' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('copies the link of the page to share it', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    getIssue.mockResolvedValue(makeIssue())
    renderPage()

    await user.click(
      await screen.findByRole('button', { name: /Copiar enlace/ }),
    )
    expect(writeText).toHaveBeenCalledWith(window.location.href)
  })

  it('does not break when the clipboard is not available', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    })
    getIssue.mockResolvedValue(makeIssue())
    renderPage()

    await user.click(
      await screen.findByRole('button', { name: /Copiar enlace/ }),
    )
    expect(screen.getByText('Error al guardar')).toBeTruthy()
  })
})

describe('issue detail page: errors', () => {
  it.each([
    [
      'an issue that does not exist or belongs to another org',
      errorResponse('NOT_FOUND', 'Issue not found', 404),
    ],
    ['a malformed id', errorResponse('VALIDATION', 'Invalid input', 400)],
  ])(
    'says the issue does not exist for %s, and offers a way back',
    async (_name, failure) => {
      const user = userEvent.setup()
      getIssue.mockRejectedValue(failure)
      renderPage()

      const alert = await screen.findByRole('alert')
      expect(within(alert).getByText('Este issue no existe')).toBeTruthy()
      await user.click(within(alert).getByRole('button', { name: 'Volver' }))
      expect(onBack).toHaveBeenCalled()
    },
  )

  it('offers a retry on a server error', async () => {
    const user = userEvent.setup()
    getIssue.mockRejectedValueOnce(
      errorResponse('INTERNAL', 'Internal server error', 500),
    )
    getIssue.mockResolvedValue(makeIssue())
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('No se pudo cargar el issue')).toBeTruthy()
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toBeTruthy(),
    )
  })
})
