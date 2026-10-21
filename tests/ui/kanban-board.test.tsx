import { QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Toaster } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import type { BoardSearch } from '@/lib/issue-filters'
import { createQueryClient } from '@/lib/query-client'
import type { IssueDto, IssuePage, SessionUser } from '@/lib/types'

vi.mock('@/server/issues/functions', () => ({
  listIssues: vi.fn(),
  listOrgUsers: vi.fn(),
  updateIssue: vi.fn(),
  createIssue: vi.fn(),
}))
const fns = await import('@/server/issues/functions')
const listIssues = vi.mocked(fns.listIssues)
const listOrgUsers = vi.mocked(fns.listOrgUsers)
const updateIssue = vi.mocked(fns.updateIssue)
const createIssue = vi.mocked(fns.createIssue)

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

function makeIssue(
  id: string,
  title: string,
  status: IssueDto['status'],
  assignee: 'ana' | 'luis' | null,
  day: number,
): IssueDto {
  const who =
    assignee === 'ana'
      ? { id: ana.id, name: 'Ana' }
      : assignee === 'luis'
        ? { id: 'u-luis', name: 'Luis' }
        : null
  return {
    id,
    title,
    description: null,
    status,
    priority: 'med',
    assigneeId: who?.id ?? null,
    assigneeName: who?.name ?? null,
    createdBy: admin.id,
    createdByName: 'Alicia',
    labels: [],
    createdAt: new Date(2026, 9, 1),
    updatedAt: new Date(2026, 9, day),
  }
}

// "Base de datos" en memoria: lo que el servidor falso devuelve y modifica.
let rows: IssueDto[]
let extraTotal = 0

function resetRows() {
  rows = [
    makeIssue('a', 'Todo de Ana', 'todo', 'ana', 5),
    makeIssue('b', 'Todo de Luis', 'todo', 'luis', 4),
    makeIssue('c', 'Progreso de Ana', 'in_progress', 'ana', 3),
    makeIssue('d', 'Hecho de Luis', 'done', 'luis', 2),
    makeIssue('e', 'Sin asignar', 'todo', null, 1),
  ]
  extraTotal = 0
}

type ListData = NonNullable<Parameters<typeof listIssues>[0]>['data']
function fakeList({ data }: { data: ListData }): Promise<IssuePage> {
  const { priority, assignee, q } = data
  const items = rows.filter(
    (i) =>
      (!priority || i.priority === priority) &&
      (!assignee ||
        (assignee === 'unassigned'
          ? !i.assigneeId
          : i.assigneeId === assignee)) &&
      (!q || i.title.toLowerCase().includes(q.toLowerCase())),
  )
  return Promise.resolve({
    items: structuredClone(items),
    total: items.length + extraTotal,
    page: 1,
    pageSize: 100,
  })
}

function Harness({ user }: { user: SessionUser }) {
  const [filters, setFilters] = useState<BoardSearch>({})
  return (
    <KanbanBoard
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
const onViewIssue = vi.fn()

function renderBoard(user: SessionUser = admin) {
  // El cliente real de la app (con su manejo central de errores) y avisos reales.
  const client = createQueryClient(() => {})
  client.setDefaultOptions({ queries: { retry: false, staleTime: 0 } })
  return render(
    <QueryClientProvider client={client}>
      <Harness user={user} />
      <Toaster />
    </QueryClientProvider>,
  )
}

const column = (name: string) =>
  within(screen.getByRole('region', { name: new RegExp(name) }))
const lastRequest = () => listIssues.mock.calls.at(-1)?.[0]?.data
const moveSelect = (title: string) =>
  screen.getByLabelText(`Mover «${title}» a`)
const errorResponse = (code: string, message: string, status: number) =>
  Response.json({ error: { code, message } }, { status })

// Una promesa que se resuelve o rechaza cuando el test lo decide.
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  resetRows()
  listIssues.mockImplementation(fakeList as never)
  listOrgUsers.mockResolvedValue([
    { id: admin.id, name: 'Alicia', role: 'admin' },
    { id: ana.id, name: 'Ana', role: 'member' },
    { id: 'u-luis', name: 'Luis', role: 'member' },
  ])
  // El servidor falso también crea: agrega la fila, igual que lo haría la base real.
  createIssue.mockImplementation((async ({
    data,
  }: {
    data: { title: string; status?: IssueDto['status'] }
  }) => {
    const row = makeIssue(
      `new-${rows.length}`,
      data.title,
      data.status ?? 'todo',
      null,
      9,
    )
    rows.push(row)
    return structuredClone(row)
  }) as never)
  updateIssue.mockImplementation((async ({
    data,
  }: {
    data: { id: string; status: IssueDto['status'] }
  }) => {
    const row = rows.find((i) => i.id === data.id)!
    row.status = data.status
    row.updatedAt = new Date()
    return structuredClone(row)
  }) as never)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('kanban board: columns', () => {
  it('asks for all the cards at once and groups them by status with counts', async () => {
    renderBoard()
    await screen.findByText('Todo de Ana')

    expect(lastRequest()).toMatchObject({ page: 1, pageSize: 100 })
    expect(lastRequest()).not.toHaveProperty('status', expect.anything())
    expect(column('Por hacer').getByText('Todo de Ana')).toBeTruthy()
    expect(
      column('Por hacer').getByText('Sin asignar', { selector: 'a' }),
    ).toBeTruthy()
    expect(column('En progreso').getByText('Progreso de Ana')).toBeTruthy()
    expect(column('Hecho').getByText('Hecho de Luis')).toBeTruthy()
    expect(
      within(screen.getByRole('region', { name: /Por hacer/ })).getByText('3'),
    ).toBeTruthy()
  })

  it('shows an empty message in a column without cards', async () => {
    rows = rows.filter((i) => i.status !== 'done')
    renderBoard()
    await screen.findByText('Todo de Ana')
    expect(column('Hecho').getByText('Sin issues')).toBeTruthy()
  })

  it('warns when there are more issues than the board can show', async () => {
    extraTotal = 120
    renderBoard()
    // (dnd-kit también tiene un elemento con rol "status": se busca por texto)
    expect(
      await screen.findByText(/100 issues más recientes de\s*125/),
    ).toBeTruthy()
  })

  it('shows an error with a retry button when the server fails', async () => {
    const user = userEvent.setup()
    listIssues.mockRejectedValueOnce(
      errorResponse('INTERNAL', 'Internal server error', 500),
    )
    renderBoard()

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('No se pudo cargar el tablero')).toBeTruthy()
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Todo de Ana')).toBeTruthy()
  })
})

describe('kanban board: optimistic move', () => {
  it('moves the card right away, before the server answers, and then refreshes', async () => {
    const user = userEvent.setup()
    const pending = deferred<IssueDto>()
    updateIssue.mockImplementationOnce((() => pending.promise) as never)
    renderBoard()
    await screen.findByText('Todo de Ana')
    const callsBefore = listIssues.mock.calls.length

    await user.selectOptions(moveSelect('Todo de Ana'), 'done')

    // El servidor todavía no respondió y la tarjeta ya está en la nueva columna.
    expect(updateIssue).toHaveBeenCalledWith({
      data: { id: 'a', status: 'done' },
    })
    await waitFor(() =>
      expect(column('Hecho').getByText('Todo de Ana')).toBeTruthy(),
    )
    expect(column('Por hacer').queryByText('Todo de Ana')).toBeNull()

    rows.find((i) => i.id === 'a')!.status = 'done'
    pending.resolve(rows.find((i) => i.id === 'a')!)
    expect(await screen.findByText(/pasó a «Hecho»/)).toBeTruthy()
    await waitFor(() =>
      expect(listIssues.mock.calls.length).toBeGreaterThan(callsBefore),
    )
    expect(column('Hecho').getByText('Todo de Ana')).toBeTruthy()
  })

  it('puts the card back in its column and says why when the server fails', async () => {
    const user = userEvent.setup()
    const pending = deferred<IssueDto>()
    updateIssue.mockImplementationOnce((() => pending.promise) as never)
    renderBoard()
    await screen.findByText('Todo de Ana')

    await user.selectOptions(moveSelect('Todo de Ana'), 'done')
    await waitFor(() =>
      expect(column('Hecho').getByText('Todo de Ana')).toBeTruthy(),
    )

    pending.reject(errorResponse('INTERNAL', 'Internal server error', 500))

    // Vuelve a «Por hacer» y aparece el aviso con el motivo.
    await waitFor(() =>
      expect(column('Por hacer').getByText('Todo de Ana')).toBeTruthy(),
    )
    expect(column('Hecho').queryByText('Todo de Ana')).toBeNull()
    expect(
      await screen.findByText(
        /No se pudo mover «Todo de Ana» a «Hecho»: Ocurrió un error en el servidor/,
      ),
    ).toBeTruthy()
    // Un solo aviso: el genérico no se suma al específico.
    expect(screen.getAllByText(/No se pudo mover/)).toHaveLength(1)
  })

  it('restores the card by itself, without waiting for the server to be asked again', async () => {
    const user = userEvent.setup()
    const pending = deferred<IssueDto>()
    updateIssue.mockImplementationOnce((() => pending.promise) as never)
    renderBoard()
    await screen.findByText('Todo de Ana')

    await user.selectOptions(moveSelect('Todo de Ana'), 'done')
    await waitFor(() =>
      expect(column('Hecho').getByText('Todo de Ana')).toBeTruthy(),
    )

    // El refresco posterior al error queda colgado: lo único que puede devolver la
    // tarjeta a su columna es la reversión de la actualización optimista.
    listIssues.mockImplementation((() => new Promise(() => {})) as never)
    pending.reject(errorResponse('INTERNAL', 'Internal server error', 500))

    await waitFor(() =>
      expect(column('Por hacer').getByText('Todo de Ana')).toBeTruthy(),
    )
    expect(column('Hecho').queryByText('Todo de Ana')).toBeNull()
  })

  it('explains a permission error from the server and restores the card', async () => {
    const user = userEvent.setup()
    updateIssue.mockRejectedValueOnce(
      errorResponse('FORBIDDEN', 'You cannot edit this issue', 403),
    )
    renderBoard()
    await screen.findByText('Todo de Ana')

    await user.selectOptions(moveSelect('Todo de Ana'), 'in_progress')

    expect(await screen.findByText(/No puedes editar este issue/)).toBeTruthy()
    await waitFor(() =>
      expect(column('Por hacer').getByText('Todo de Ana')).toBeTruthy(),
    )
  })

  it('only restores the card that failed when several moves are in flight', async () => {
    const user = userEvent.setup()
    const first = deferred<IssueDto>()
    const second = deferred<IssueDto>()
    updateIssue.mockImplementationOnce((() => first.promise) as never)
    updateIssue.mockImplementationOnce((() => second.promise) as never)
    renderBoard()
    await screen.findByText('Todo de Ana')

    await user.selectOptions(moveSelect('Todo de Ana'), 'done')
    await user.selectOptions(moveSelect('Todo de Luis'), 'done')
    await waitFor(() =>
      expect(column('Hecho').getByText('Todo de Luis')).toBeTruthy(),
    )

    // El segundo falla; el primero sigue en curso y no debe deshacerse.
    second.reject(errorResponse('INTERNAL', 'Internal server error', 500))
    await waitFor(() =>
      expect(column('Por hacer').getByText('Todo de Luis')).toBeTruthy(),
    )
    expect(column('Hecho').getByText('Todo de Ana')).toBeTruthy()

    rows.find((i) => i.id === 'a')!.status = 'done'
    first.resolve(rows.find((i) => i.id === 'a')!)
    await waitFor(() =>
      expect(column('Hecho').getByText('Todo de Ana')).toBeTruthy(),
    )
    expect(column('Por hacer').getByText('Todo de Luis')).toBeTruthy()
  })

  it('does not call the server when the card is "moved" to the column it is already in', async () => {
    const user = userEvent.setup()
    renderBoard()
    await screen.findByText('Todo de Ana')
    await user.selectOptions(moveSelect('Todo de Ana'), 'todo')
    expect(updateIssue).not.toHaveBeenCalled()
  })

  it('keeps the persisted state after a reload', async () => {
    const user = userEvent.setup()
    renderBoard()
    await screen.findByText('Todo de Ana')
    await user.selectOptions(moveSelect('Todo de Ana'), 'done')
    await waitFor(() => expect(updateIssue).toHaveBeenCalled())
    cleanup()

    // "Recargar": una pantalla nueva, sin caché, que pide todo al servidor.
    renderBoard()
    await screen.findByText('Progreso de Ana')
    expect(column('Hecho').getByText('Todo de Ana')).toBeTruthy()
  })
})

describe('kanban board: permissions', () => {
  it('lets a member drag only the cards assigned to them, and explains the others', async () => {
    renderBoard(ana)
    await screen.findByText('Todo de Ana')

    expect(
      screen.getByRole('button', { name: 'Arrastrar «Todo de Ana»' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Arrastrar «Progreso de Ana»' }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /Arrastrar «Todo de Luis»/ }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: /Arrastrar «Sin asignar»/ }),
    ).toBeNull()
    expect(screen.queryByLabelText('Mover «Todo de Luis» a')).toBeNull()
    // Las bloqueadas llevan el candado con su explicación (3 tarjetas no son de Ana).
    expect(
      screen.getAllByRole('img', {
        name: /Solo la persona asignada o un administrador/,
      }),
    ).toHaveLength(3)
  })

  it('lets an admin drag every card', async () => {
    renderBoard(admin)
    await screen.findByText('Todo de Ana')
    expect(
      screen.getAllByRole('button', { name: /^Arrastrar «/ }),
    ).toHaveLength(5)
    expect(
      screen.queryAllByRole('img', { name: /Solo la persona asignada/ }),
    ).toHaveLength(0)
  })
})

describe('kanban board: opening and filtering', () => {
  it('opens the detail on a plain click and leaves Ctrl+click to the browser', async () => {
    const user = userEvent.setup()
    renderBoard(ana)
    const link = await screen.findByRole('link', { name: 'Todo de Ana' })
    expect(link.getAttribute('href')).toBe('/issues/a')

    await user.click(link)
    expect(onViewIssue).toHaveBeenCalledTimes(1)
    expect(onViewIssue).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a' }),
    )

    onViewIssue.mockClear()
    await user.keyboard('{Control>}')
    await user.click(link)
    await user.keyboard('{/Control}')
    expect(onViewIssue).not.toHaveBeenCalled()
  })

  it('opens the detail when tapping the empty part of the card, but not the move selector', async () => {
    const user = userEvent.setup()
    renderBoard()
    await screen.findByText('Todo de Ana')

    await user.selectOptions(moveSelect('Todo de Ana'), 'done')
    expect(onViewIssue).not.toHaveBeenCalled()

    const card = screen
      .getByRole('link', { name: 'Todo de Luis' })
      .closest('li')!
    await user.click(card)
    expect(onViewIssue).toHaveBeenCalledTimes(1)
  })

  it('combines filters without losing the previous ones, and never filters by status', async () => {
    const user = userEvent.setup()
    renderBoard()
    await screen.findByText('Todo de Ana')
    expect(screen.queryByLabelText('Filtrar por estado')).toBeNull()

    await user.selectOptions(
      screen.getByLabelText('Filtrar por responsable'),
      'unassigned',
    )
    await waitFor(() =>
      expect(lastRequest()).toMatchObject({ assignee: 'unassigned' }),
    )

    await user.type(screen.getByLabelText('Buscar issues'), 'sin')
    await waitFor(() =>
      expect(lastRequest()).toMatchObject({ assignee: 'unassigned', q: 'sin' }),
    )
    expect(lastRequest()).not.toHaveProperty('status', expect.anything())
    expect(
      await screen.findByText('Sin asignar', { selector: 'a' }),
    ).toBeTruthy()
    expect(screen.queryByText('Todo de Ana')).toBeNull()
  })
})

describe('kanban board: refresh button', () => {
  it('picks up changes made by somebody else (a card that was deleted disappears)', async () => {
    const user = userEvent.setup()
    renderBoard()
    await screen.findByText('Todo de Luis')

    // Otra persona borra una tarjeta en otra ventana.
    rows = rows.filter((issue) => issue.id !== 'b')
    expect(screen.getByText('Todo de Luis')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Actualizar tablero' }))
    await waitFor(() => expect(screen.queryByText('Todo de Luis')).toBeNull())
    expect(column('Por hacer').getByText('Todo de Ana')).toBeTruthy()
  })

  it('is disabled and spinning while the board is being refreshed', async () => {
    const user = userEvent.setup()
    renderBoard()
    await screen.findByText('Todo de Ana')

    const pending = deferred<IssuePage>()
    listIssues.mockImplementationOnce((() => pending.promise) as never)
    const button = screen.getByRole('button', { name: 'Actualizar tablero' })
    await user.click(button)

    await waitFor(() =>
      expect((button as HTMLButtonElement).disabled).toBe(true),
    )
    expect(button.querySelector('svg')?.getAttribute('class')).toContain(
      'animate-spin',
    )

    pending.resolve(
      await fakeList({ data: { page: 1, pageSize: 100 } as never }),
    )
    await waitFor(() =>
      expect((button as HTMLButtonElement).disabled).toBe(false),
    )
  })
})

describe('kanban board: creating a new issue', () => {
  it('offers the "Nuevo issue" button to an admin and to a member', async () => {
    renderBoard(admin)
    expect(
      await screen.findByRole('button', { name: /Nuevo issue/ }),
    ).toBeTruthy()
    cleanup()
    renderBoard(ana)
    expect(
      await screen.findByRole('button', { name: /Nuevo issue/ }),
    ).toBeTruthy()
  })

  it('creates the issue and shows it in the "Por hacer" column without reloading', async () => {
    const user = userEvent.setup()
    renderBoard()
    await screen.findByText('Todo de Ana')

    await user.click(screen.getByRole('button', { name: /Nuevo issue/ }))
    await user.type(await screen.findByLabelText('Título'), 'Tarea nueva')
    await user.click(screen.getByRole('button', { name: 'Crear issue' }))

    await waitFor(() => expect(createIssue).toHaveBeenCalledTimes(1))
    expect(createIssue.mock.calls[0]![0]!.data).toMatchObject({
      title: 'Tarea nueva',
      status: 'todo',
    })
    // El formulario se cierra y la tarjeta aparece en su columna.
    expect(await column('Por hacer').findByText('Tarea nueva')).toBeTruthy()
    expect(screen.queryByText('Nuevo issue', { selector: 'h2' })).toBeNull()
  })

  it('puts the new card in the column of the status chosen in the form', async () => {
    const user = userEvent.setup()
    renderBoard()
    await screen.findByText('Todo de Ana')

    await user.click(screen.getByRole('button', { name: /Nuevo issue/ }))
    await user.type(await screen.findByLabelText('Título'), 'Ya empezada')
    await user.selectOptions(screen.getByLabelText('Estado'), 'in_progress')
    await user.click(screen.getByRole('button', { name: 'Crear issue' }))

    expect(await column('En progreso').findByText('Ya empezada')).toBeTruthy()
    expect(column('Por hacer').queryByText('Ya empezada')).toBeNull()
  })

  it('keeps the member rules: no assignee to choose, and none is sent', async () => {
    const user = userEvent.setup()
    renderBoard(ana)
    await screen.findByText('Todo de Ana')

    await user.click(screen.getByRole('button', { name: /Nuevo issue/ }))
    expect(await screen.findByText('Se te asignará a ti')).toBeTruthy()
    await user.type(screen.getByLabelText('Título'), 'Mi tarea')
    await user.click(screen.getByRole('button', { name: 'Crear issue' }))

    await waitFor(() => expect(createIssue).toHaveBeenCalledTimes(1))
    expect(createIssue.mock.calls[0]![0]!.data).not.toHaveProperty('assigneeId')
  })

  it('does not call the server with an empty title', async () => {
    const user = userEvent.setup()
    renderBoard()
    await screen.findByText('Todo de Ana')

    await user.click(screen.getByRole('button', { name: /Nuevo issue/ }))
    await user.click(await screen.findByRole('button', { name: 'Crear issue' }))

    expect(await screen.findByText('El título es obligatorio')).toBeTruthy()
    expect(createIssue).not.toHaveBeenCalled()
  })
})
