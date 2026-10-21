import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Toaster, toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IssuesView } from '@/components/issues/issues-view'
import { formatDate } from '@/lib/format'
import type { IssueSearch } from '@/lib/issue-filters'
import type { IssueDto, IssuePage, SessionUser } from '@/lib/types'

// Solo se simulan las server functions; todo lo demás es el código real.
vi.mock('@/server/issues/functions', () => ({
  listIssues: vi.fn(),
  listOrgUsers: vi.fn(),
  getIssue: vi.fn(),
  createIssue: vi.fn(),
  updateIssue: vi.fn(),
  deleteIssue: vi.fn(),
}))
const fns = await import('@/server/issues/functions')
const listIssues = vi.mocked(fns.listIssues)
const listOrgUsers = vi.mocked(fns.listOrgUsers)
const getIssue = vi.mocked(fns.getIssue)
const createIssue = vi.mocked(fns.createIssue)
const deleteIssue = vi.mocked(fns.deleteIssue)
const updateIssue = vi.mocked(fns.updateIssue)

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
const luis = { id: 'u-luis', name: 'Luis', role: 'member' as const }

// 45 issues falsos (3 páginas de 20). Se reparten estados y responsables.
const STATUSES = ['todo', 'in_progress', 'done'] as const
const PRIORITIES = ['low', 'med', 'high'] as const
// UUID válidos: los esquemas exigen este formato al editar o borrar un issue.
const issueId = (i: number) =>
  `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
const ALL: IssueDto[] = Array.from({ length: 45 }, (_, i) => {
  const assignee = i % 5 === 0 ? null : i % 2 === 0 ? ana : luis
  return {
    id: issueId(i),
    title: i === 3 ? 'Login roto' : `Issue ${String(i + 1).padStart(2, '0')}`,
    description: i === 1 ? '## Pasos\n\n1. Abrir\n2. **Guardar**' : null,
    status: STATUSES[i % 3]!,
    priority: PRIORITIES[(i * 7) % 3]!,
    position: i + 1,
    assigneeId: assignee?.id ?? null,
    assigneeName: assignee?.name ?? null,
    createdBy: admin.id,
    createdByName: admin.name,
    labels: i === 1 ? ['bug'] : [],
    createdAt: new Date(2026, 9, 1),
    updatedAt: new Date(2026, 9, 1),
  }
})

type ListData = NonNullable<Parameters<typeof listIssues>[0]>['data']

// Imita lo que haría el servidor: filtra, busca y pagina.
function fakeServer({ data }: { data: ListData }): Promise<IssuePage> {
  const { page = 1, pageSize = 20, status, priority, assignee, q } = data
  const matches = ALL.filter(
    (issue) =>
      (!status || issue.status === status) &&
      (!priority || issue.priority === priority) &&
      (!assignee ||
        (assignee === 'unassigned'
          ? !issue.assigneeId
          : issue.assigneeId === assignee)) &&
      (!q || issue.title.toLowerCase().includes(q.toLowerCase())),
  )
  return Promise.resolve({
    items: matches.slice((page - 1) * pageSize, page * pageSize),
    total: matches.length,
    page,
    pageSize,
  })
}

const onViewIssue = vi.fn()

// Hace de "ruta": guarda los filtros en estado, como la URL en la app real.
function Harness({ user }: { user: SessionUser }) {
  const [filters, setFilters] = useState<IssueSearch>({})
  return (
    <IssuesView
      user={user}
      filters={filters}
      onFiltersChange={(patch) =>
        setFilters((current) => ({ ...current, ...patch }))
      }
      issueHref={(issue) => `/issues/${issue.id}`}
      onViewIssue={onViewIssue}
    />
  )
}

function renderView(user: SessionUser = admin) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <Harness user={user} />
      <Toaster />
    </QueryClientProvider>,
  )
}

const lastRequest = () => listIssues.mock.calls.at(-1)?.[0]?.data

beforeEach(() => {
  listIssues.mockImplementation(fakeServer as never)
  getIssue.mockImplementation((({ data }: { data: { id: string } }) =>
    Promise.resolve(ALL.find((issue) => issue.id === data.id)!)) as never)
  listOrgUsers.mockResolvedValue([
    { id: admin.id, name: admin.name, role: 'admin' },
    { id: ana.id, name: ana.name, role: 'member' },
    luis,
  ])
})

afterEach(() => {
  cleanup()
  // Los avisos de sonner son globales: sin esto, el de un test aparece en el siguiente.
  toast.dismiss()
  vi.clearAllMocks()
})

describe('issue list: filters, search and pagination', () => {
  it('loads the first page from the server', async () => {
    renderView()
    expect(await screen.findByText('Issue 01')).toBeTruthy()
    expect(lastRequest()).toMatchObject({ page: 1, pageSize: 20 })
    expect(screen.getAllByText(/Página 1 de 3 · 45 issues/)).toHaveLength(2)
    expect(screen.queryByText('Issue 21')).toBeNull()
  })

  it('asks the server for "done" issues when the status filter changes', async () => {
    const user = userEvent.setup()
    renderView()
    await screen.findByText('Issue 01')

    await user.selectOptions(
      screen.getByLabelText('Filtrar por estado'),
      'done',
    )

    await waitFor(() =>
      expect(lastRequest()).toMatchObject({ status: 'done', page: 1 }),
    )
    // Issue 01 es "todo": ya no debe estar; Issue 03 es "done".
    await waitFor(() => expect(screen.queryByText('Issue 01')).toBeNull())
    expect(await screen.findByText('Issue 03')).toBeTruthy()
    expect(screen.getAllByText(/Página 1 de 1 · 15 issues/)).toHaveLength(2)
  })

  it('asks for page 2 on "Siguiente" and goes back to page 1 when a filter changes', async () => {
    const user = userEvent.setup()
    renderView()
    await screen.findByText('Issue 01')

    await user.click(
      screen.getAllByRole('button', { name: 'Página siguiente' })[0]!,
    )
    await waitFor(() => expect(lastRequest()).toMatchObject({ page: 2 }))
    expect(await screen.findByText('Issue 21')).toBeTruthy()
    expect(screen.getAllByText(/Página 2 de 3/)).toHaveLength(2)

    await user.selectOptions(
      screen.getByLabelText('Filtrar por prioridad'),
      'high',
    )
    await waitFor(() =>
      expect(lastRequest()).toMatchObject({ priority: 'high', page: 1 }),
    )
  })

  it('offers page controls above and below the list, and both work', async () => {
    const user = userEvent.setup()
    renderView()
    await screen.findByText('Issue 01')
    expect(
      screen.getAllByRole('navigation', { name: /^Paginación/ }),
    ).toHaveLength(2)

    // La barra de arriba (la que se alcanza sin hacer scroll) avanza...
    await user.click(
      screen.getAllByRole('button', { name: 'Página siguiente' })[0]!,
    )
    expect(await screen.findByText('Issue 21')).toBeTruthy()

    // ...y la de abajo retrocede.
    await user.click(
      screen.getAllByRole('button', { name: 'Página anterior' })[1]!,
    )
    await waitFor(() => expect(lastRequest()).toMatchObject({ page: 1 }))
    expect(await screen.findByText('Issue 01')).toBeTruthy()
  })

  it('shows the updated date under the title, so small screens do not lose it', async () => {
    renderView()
    await screen.findByText('Issue 01')
    const expected = `Actualizado ${formatDate(new Date(2026, 9, 1))}`
    expect(screen.getAllByText(expected)).toHaveLength(20)
  })

  it('filters by assignee, including "Sin asignar"', async () => {
    const user = userEvent.setup()
    renderView()
    await screen.findByText('Issue 01')

    await user.selectOptions(
      screen.getByLabelText('Filtrar por responsable'),
      'unassigned',
    )
    await waitFor(() =>
      expect(lastRequest()).toMatchObject({ assignee: 'unassigned' }),
    )
    expect(
      (await screen.findAllByText(/Página 1 de 1 · 9 issues/)).length,
    ).toBe(2)
  })

  it('searches only after the user stops typing', async () => {
    const user = userEvent.setup()
    renderView()
    await screen.findByText('Issue 01')
    const callsBefore = listIssues.mock.calls.length

    await user.type(screen.getByLabelText('Buscar issues'), 'login')

    // Tecleó 5 letras seguidas: aún no se pidió nada al servidor...
    expect(listIssues.mock.calls.length).toBe(callsBefore)
    // ...y al dejar de escribir se hace una sola petición con el texto completo.
    await waitFor(() => expect(lastRequest()).toMatchObject({ q: 'login' }))
    expect(listIssues.mock.calls.length).toBe(callsBefore + 1)
    expect(await screen.findByText('Login roto')).toBeTruthy()
  })

  it('shows an empty state with "Limpiar filtros" when nothing matches', async () => {
    const user = userEvent.setup()
    renderView()
    await screen.findByText('Issue 01')

    await user.type(screen.getByLabelText('Buscar issues'), 'zzz-no-existe')
    expect(
      await screen.findByText('Ningún issue coincide con los filtros'),
    ).toBeTruthy()

    await user.click(
      screen.getAllByRole('button', { name: 'Limpiar filtros' }).at(-1)!,
    )
    expect(await screen.findByText('Issue 01')).toBeTruthy()
    expect(lastRequest()?.q).toBeUndefined()
  })

  it('shows an error with a retry button when the server fails', async () => {
    const user = userEvent.setup()
    listIssues.mockRejectedValueOnce(
      Response.json(
        { error: { code: 'INTERNAL', message: 'Internal server error' } },
        { status: 500 },
      ),
    )
    renderView()

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('No se pudo cargar la lista')).toBeTruthy()

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Issue 01')).toBeTruthy()
  })
})

describe('issue list: permissions in the UI', () => {
  it('shows edit and delete buttons to an admin on every issue', async () => {
    renderView(admin)
    await screen.findByText('Issue 01')
    expect(screen.getAllByRole('button', { name: /^Editar / })).toHaveLength(20)
    expect(screen.getAllByRole('button', { name: /^Eliminar / })).toHaveLength(
      20,
    )
  })

  it('shows a member edit only on their own issues, and never delete', async () => {
    renderView(ana)
    await screen.findByText('Issue 01')

    const mine = ALL.slice(0, 20).filter((issue) => issue.assigneeId === ana.id)
    expect(screen.getAllByRole('button', { name: /^Editar / })).toHaveLength(
      mine.length,
    )
    expect(
      screen.queryAllByRole('button', { name: /^Eliminar / }),
    ).toHaveLength(0)
    // Issue 03 es de Luis: sin botón de editar. Issue 03 (i=2) es de Ana: con botón.
    expect(screen.queryByRole('button', { name: 'Editar Issue 02' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Editar Issue 03' })).toBeTruthy()
  })
})

describe('issue form and delete', () => {
  it('validates the title on the client without calling the server', async () => {
    const user = userEvent.setup()
    renderView(ana)
    await screen.findByText('Issue 01')

    await user.click(screen.getByRole('button', { name: /Nuevo issue/ }))
    await user.click(await screen.findByRole('button', { name: 'Crear issue' }))

    expect(await screen.findByText('El título es obligatorio')).toBeTruthy()
    expect(createIssue).not.toHaveBeenCalled()
  })

  it('lets a member create an issue without choosing an assignee', async () => {
    const user = userEvent.setup()
    createIssue.mockResolvedValue(ALL[0]!)
    renderView(ana)
    await screen.findByText('Issue 01')
    const callsBefore = listIssues.mock.calls.length

    await user.click(screen.getByRole('button', { name: /Nuevo issue/ }))
    expect(await screen.findByText('Se te asignará a ti')).toBeTruthy()
    await user.type(screen.getByLabelText('Título'), '  Mi issue  ')
    await user.click(screen.getByRole('button', { name: 'Crear issue' }))

    await waitFor(() => expect(createIssue).toHaveBeenCalledTimes(1))
    const sent = createIssue.mock.calls[0]![0]!.data
    expect(sent).toMatchObject({
      title: 'Mi issue',
      status: 'todo',
      priority: 'med',
    })
    expect(sent).not.toHaveProperty('assigneeId')
    // Al guardar se refresca la lista.
    await waitFor(() =>
      expect(listIssues.mock.calls.length).toBeGreaterThan(callsBefore),
    )
  })

  it('lets an admin pick the assignee in the form', async () => {
    const user = userEvent.setup()
    renderView(admin)
    await screen.findByText('Issue 01')

    await user.click(screen.getByRole('button', { name: /Nuevo issue/ }))
    const select = await screen.findByLabelText('Responsable')
    expect(within(select).getByRole('option', { name: 'Luis' })).toBeTruthy()
  })

  it('deletes an issue only after the admin confirms', async () => {
    const user = userEvent.setup()
    deleteIssue.mockResolvedValue({ id: issueId(0) })
    renderView(admin)
    await screen.findByText('Issue 01')

    await user.click(screen.getByRole('button', { name: 'Eliminar Issue 01' }))
    expect(await screen.findByText('¿Eliminar este issue?')).toBeTruthy()
    expect(deleteIssue).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    await waitFor(() =>
      expect(deleteIssue).toHaveBeenCalledWith({ data: { id: issueId(0) } }),
    )
  })
})

describe('link to the issue detail', () => {
  it('lets a member open an issue that is not assigned to them', async () => {
    const user = userEvent.setup()
    renderView(ana)
    await screen.findByText('Issue 01')
    // Issue 01 está sin asignar: Ana no tiene acciones en esa fila...
    expect(screen.queryByRole('button', { name: 'Editar Issue 01' })).toBeNull()

    // ...pero sí puede abrir su detalle.
    await user.click(screen.getByText('Issue 01'))
    expect(onViewIssue).toHaveBeenCalledTimes(1)
    expect(onViewIssue).toHaveBeenCalledWith(
      expect.objectContaining({ id: issueId(0) }),
    )
  })

  it('gives the title a real URL, so it can be copied or opened in a new tab', async () => {
    renderView(ana)
    const link = await screen.findByRole('link', { name: 'Issue 02' })
    expect(link.getAttribute('href')).toBe(`/issues/${issueId(1)}`)
  })

  it('opens when tapping anywhere on the title cell, only once', async () => {
    const user = userEvent.setup()
    renderView(ana)
    await screen.findByText('Issue 02')

    await user.click(screen.getByText('Issue 02').closest('td')!)
    expect(onViewIssue).toHaveBeenCalledTimes(1)
  })

  it('does not navigate twice when the title link itself is clicked', async () => {
    const user = userEvent.setup()
    renderView(ana)
    await user.click(await screen.findByRole('link', { name: 'Issue 02' }))
    expect(onViewIssue).toHaveBeenCalledTimes(1)
  })

  it('leaves Ctrl/Cmd+click to the browser (new tab) instead of navigating here', async () => {
    const user = userEvent.setup()
    renderView(ana)
    const link = await screen.findByRole('link', { name: 'Issue 02' })

    await user.keyboard('{Control>}')
    await user.click(link)
    await user.keyboard('{/Control}')
    expect(onViewIssue).not.toHaveBeenCalled()
  })
})

describe('issue list: collapsible filters on small screens', () => {
  it('hides the selectors behind a "Filtros" button that opens and closes them', async () => {
    const user = userEvent.setup()
    renderView()
    await screen.findByText('Issue 01')

    const toggle = screen.getByRole('button', { name: /^Filtros/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    await user.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    // El botón apunta a la zona que abre, para los lectores de pantalla.
    expect(
      document.getElementById(toggle.getAttribute('aria-controls')!),
    ).toBeTruthy()
    await user.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('shows how many filters are active on the button', async () => {
    const user = userEvent.setup()
    renderView()
    await screen.findByText('Issue 01')
    expect(screen.getByRole('button', { name: 'Filtros' })).toBeTruthy()

    await user.selectOptions(
      screen.getByLabelText('Filtrar por prioridad'),
      'high',
    )
    expect(
      await screen.findByRole('button', { name: 'Filtros (1)' }),
    ).toBeTruthy()
    await user.selectOptions(
      screen.getByLabelText('Filtrar por estado'),
      'done',
    )
    expect(
      await screen.findByRole('button', { name: 'Filtros (2)' }),
    ).toBeTruthy()
  })
})

describe('issue list: an issue that somebody else already deleted', () => {
  it('tells the user and refreshes the list when deleting an issue that no longer exists', async () => {
    const user = userEvent.setup()
    deleteIssue.mockRejectedValueOnce(
      Response.json(
        { error: { code: 'NOT_FOUND', message: 'Issue not found' } },
        { status: 404 },
      ),
    )
    renderView(admin)
    await screen.findByText('Issue 01')
    const callsBefore = listIssues.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Eliminar Issue 01' }))
    await user.click(await screen.findByRole('button', { name: 'Eliminar' }))

    expect(
      await screen.findByText('El issue no existe o no tienes acceso a él'),
    ).toBeTruthy()
    // El diálogo se cierra y la lista se vuelve a pedir.
    await waitFor(() =>
      expect(screen.queryByText('¿Eliminar este issue?')).toBeNull(),
    )
    await waitFor(() =>
      expect(listIssues.mock.calls.length).toBeGreaterThan(callsBefore),
    )
  })

  it('tells the user and refreshes the list when editing an issue that no longer exists', async () => {
    const user = userEvent.setup()
    updateIssue.mockRejectedValueOnce(
      Response.json(
        { error: { code: 'NOT_FOUND', message: 'Issue not found' } },
        { status: 404 },
      ),
    )
    renderView(admin)
    await screen.findByText('Issue 01')
    const callsBefore = listIssues.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Editar Issue 01' }))
    await user.click(
      await screen.findByRole('button', { name: 'Guardar cambios' }),
    )

    expect(
      await screen.findByText('El issue no existe o no tienes acceso a él'),
    ).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('Editar issue')).toBeNull())
    await waitFor(() =>
      expect(listIssues.mock.calls.length).toBeGreaterThan(callsBefore),
    )
  })
})

describe('issue list: refresh button', () => {
  it('asks the server again without reloading the page, and shows that it is working', async () => {
    const user = userEvent.setup()
    renderView()
    await screen.findByText('Issue 01')
    const callsBefore = listIssues.mock.calls.length

    let finish!: (page: IssuePage) => void
    listIssues.mockImplementationOnce(
      (() =>
        new Promise<IssuePage>((resolve) => {
          finish = resolve
        })) as never,
    )

    const button = screen.getByRole('button', { name: 'Actualizar lista' })
    await user.click(button)

    // Mientras llega la respuesta: se volvió a pedir, y el botón está ocupado.
    expect(listIssues.mock.calls.length).toBe(callsBefore + 1)
    await waitFor(() =>
      expect((button as HTMLButtonElement).disabled).toBe(true),
    )
    expect(button.getAttribute('aria-busy')).toBe('true')
    // Los datos que ya estaban siguen a la vista (no salta a un esqueleto).
    expect(screen.getByText('Issue 01')).toBeTruthy()

    finish(await fakeServer({ data: { page: 1, pageSize: 20 } as never }))
    await waitFor(() =>
      expect((button as HTMLButtonElement).disabled).toBe(false),
    )
    expect(button.getAttribute('aria-busy')).toBe('false')
  })

  it('keeps the current filters and page when refreshing', async () => {
    const user = userEvent.setup()
    renderView()
    await screen.findByText('Issue 01')
    await user.selectOptions(
      screen.getByLabelText('Filtrar por estado'),
      'done',
    )
    await waitFor(() => expect(lastRequest()).toMatchObject({ status: 'done' }))

    await user.click(screen.getByRole('button', { name: 'Actualizar lista' }))
    await waitFor(() => expect(listIssues.mock.calls.length).toBeGreaterThan(2))
    expect(lastRequest()).toMatchObject({ status: 'done', page: 1 })
  })
})
