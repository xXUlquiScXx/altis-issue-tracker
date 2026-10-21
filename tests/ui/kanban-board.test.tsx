import { QueryClientProvider } from '@tanstack/react-query'
import type { DndContextProps } from '@dnd-kit/core'
import {
  act,
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
import { KanbanBoard } from '@/components/kanban/kanban-board'
import type { BoardSearch } from '@/lib/issue-filters'
import { positionForDrop } from '@/lib/kanban'
import { createQueryClient } from '@/lib/query-client'
import type { IssueDto, IssuePage, SessionUser } from '@/lib/types'

// Se deja el DndContext real, pero se guardan sus propiedades: así el test puede
// disparar `onDragEnd` / `onDragMove` como lo haría el puntero al arrastrar.
const dnd = vi.hoisted(() => ({
  props: undefined as unknown as DndContextProps,
}))
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  const { createElement } = await import('react')
  return {
    ...actual,
    DndContext: (props: DndContextProps) => {
      dnd.props = props
      return createElement(actual.DndContext, props)
    },
  }
})

vi.mock('@/server/issues/functions', () => ({
  listIssues: vi.fn(),
  listOrgUsers: vi.fn(),
  moveIssue: vi.fn(),
  createIssue: vi.fn(),
}))
const fns = await import('@/server/issues/functions')
const listIssues = vi.mocked(fns.listIssues)
const listOrgUsers = vi.mocked(fns.listOrgUsers)
const moveIssue = vi.mocked(fns.moveIssue)
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
    position: 0,
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
  // Posición inicial: dentro de cada columna, la más reciente arriba.
  for (const status of ['todo', 'in_progress', 'done'] as const) {
    rows
      .filter((row) => row.status === status)
      .sort((x, y) => y.updatedAt.getTime() - x.updatedAt.getTime())
      .forEach((row, index) => {
        row.position = index + 1
      })
  }
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
    row.position = positionForDrop(rows, row, row.status, null)
    rows.push(row)
    return structuredClone(row)
  }) as never)
  // El servidor falso de «mover»: misma cuenta de posición que el real.
  moveIssue.mockImplementation((async ({
    data,
  }: {
    data: { id: string; status: IssueDto['status']; afterId?: string | null }
  }) => {
    const row = rows.find((i) => i.id === data.id)!
    row.position = positionForDrop(rows, row, data.status, data.afterId ?? null)
    if (row.status !== data.status) row.updatedAt = new Date()
    row.status = data.status
    return structuredClone(row)
  }) as never)
})

afterEach(() => {
  cleanup()
  // Los avisos de sonner son globales: sin esto, el de un test aparece en el siguiente.
  toast.dismiss()
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
    moveIssue.mockImplementationOnce((() => pending.promise) as never)
    renderBoard()
    await screen.findByText('Todo de Ana')
    const callsBefore = listIssues.mock.calls.length

    await user.selectOptions(moveSelect('Todo de Ana'), 'done')

    // El servidor todavía no respondió y la tarjeta ya está en la nueva columna.
    expect(moveIssue).toHaveBeenCalledWith({
      data: { id: 'a', status: 'done', afterId: null },
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
    moveIssue.mockImplementationOnce((() => pending.promise) as never)
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
    moveIssue.mockImplementationOnce((() => pending.promise) as never)
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
    moveIssue.mockRejectedValueOnce(
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
    moveIssue.mockImplementationOnce((() => first.promise) as never)
    moveIssue.mockImplementationOnce((() => second.promise) as never)
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
    expect(moveIssue).not.toHaveBeenCalled()
  })

  it('keeps the persisted state after a reload', async () => {
    const user = userEvent.setup()
    renderBoard()
    await screen.findByText('Todo de Ana')
    await user.selectOptions(moveSelect('Todo de Ana'), 'done')
    await waitFor(() => expect(moveIssue).toHaveBeenCalled())
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

// ---- Orden manual dentro de la columna ----------------------------------------
// Se simula lo que dnd-kit entrega al soltar una tarjeta: cuál, sobre qué, y en
// qué mitad de esa tarjeta quedó el centro de la arrastrada.
const rect = (top: number) => ({
  top,
  height: 20,
  left: 0,
  width: 100,
  bottom: top + 20,
  right: 100,
})
function dragEvent(activeId: string, overId: string, below: boolean) {
  return {
    active: {
      id: activeId,
      rect: { current: { initial: null, translated: rect(below ? 90 : 10) } },
    },
    over: { id: overId, rect: rect(40) },
  } as never
}
const dropOn = (activeId: string, overId: string, below = true) =>
  act(() => dnd.props.onDragEnd?.(dragEvent(activeId, overId, below)))
const hoverOn = (activeId: string, overId: string, below = true) =>
  act(() => dnd.props.onDragMove?.(dragEvent(activeId, overId, below)))
// Los títulos de una columna, de arriba hacia abajo.
const titlesOf = (name: string) =>
  column(name)
    .getAllByRole('link')
    .map((link) => link.textContent)

describe('kanban board: ordering cards inside a column', () => {
  // «Por hacer», de arriba hacia abajo: Todo de Ana (a), Todo de Luis (b), Sin asignar (e)

  it('starts with the saved order of each column', async () => {
    renderBoard()
    await screen.findByText('Todo de Ana')
    expect(titlesOf('Por hacer')).toEqual([
      'Todo de Ana',
      'Todo de Luis',
      'Sin asignar',
    ])
  })

  it('moves a card down inside its column, instantly, and sends where it was dropped', async () => {
    const pending = deferred<IssueDto>()
    moveIssue.mockImplementationOnce((() => pending.promise) as never)
    renderBoard()
    await screen.findByText('Todo de Ana')

    await dropOn('a', 'b', true) // «Todo de Ana» debajo de «Todo de Luis»

    expect(moveIssue).toHaveBeenCalledWith({
      data: { id: 'a', status: 'todo', afterId: 'b' },
    })
    // Ya está en su nuevo lugar aunque el servidor no respondió.
    await waitFor(() =>
      expect(titlesOf('Por hacer')).toEqual([
        'Todo de Luis',
        'Todo de Ana',
        'Sin asignar',
      ]),
    )
    pending.resolve(rows[0]!)
  })

  it('moves a card up when it is dropped on the upper half of another one', async () => {
    renderBoard()
    await screen.findByText('Todo de Ana')

    await dropOn('e', 'b', false) // «Sin asignar» encima de «Todo de Luis»

    expect(moveIssue).toHaveBeenCalledWith({
      data: { id: 'e', status: 'todo', afterId: 'a' },
    })
    await waitFor(() =>
      expect(titlesOf('Por hacer')).toEqual([
        'Todo de Ana',
        'Sin asignar',
        'Todo de Luis',
      ]),
    )
  })

  it('puts a card at the very top when it is dropped above the first one', async () => {
    renderBoard()
    await screen.findByText('Todo de Ana')
    await dropOn('e', 'a', false)
    expect(moveIssue).toHaveBeenCalledWith({
      data: { id: 'e', status: 'todo', afterId: null },
    })
    await waitFor(() =>
      expect(titlesOf('Por hacer')).toEqual([
        'Sin asignar',
        'Todo de Ana',
        'Todo de Luis',
      ]),
    )
  })

  it('drops between two cards of ANOTHER column and changes the status', async () => {
    renderBoard()
    await screen.findByText('Todo de Ana')

    await dropOn('a', 'c', true) // debajo de «Progreso de Ana»

    expect(moveIssue).toHaveBeenCalledWith({
      data: { id: 'a', status: 'in_progress', afterId: 'c' },
    })
    await waitFor(() =>
      expect(titlesOf('En progreso')).toEqual([
        'Progreso de Ana',
        'Todo de Ana',
      ]),
    )
    expect(titlesOf('Por hacer')).toEqual(['Todo de Luis', 'Sin asignar'])
  })

  it('puts a card at the end of a column when it is dropped on the empty part of the column', async () => {
    renderBoard()
    await screen.findByText('Todo de Ana')
    await dropOn('a', 'done') // soltada sobre la columna «Hecho», no sobre una tarjeta
    expect(moveIssue).toHaveBeenCalledWith({
      data: { id: 'a', status: 'done', afterId: 'd' },
    })
    await waitFor(() =>
      expect(titlesOf('Hecho')).toEqual(['Hecho de Luis', 'Todo de Ana']),
    )
  })

  it('does nothing when the card is dropped where it already was', async () => {
    renderBoard()
    await screen.findByText('Todo de Ana')
    await dropOn('a', 'a') // sobre sí misma
    await dropOn('b', 'a', true) // debajo de «a»: donde ya está «b»
    await dropOn('a', 'b', false) // encima de «b»: donde ya está «a»
    expect(moveIssue).not.toHaveBeenCalled()
  })

  it('puts the card back in its place and says why when the server rejects the reorder', async () => {
    moveIssue.mockRejectedValueOnce(
      errorResponse('FORBIDDEN', 'You cannot edit this issue', 403),
    )
    renderBoard()
    await screen.findByText('Todo de Ana')

    await dropOn('a', 'b', true)

    expect(
      await screen.findByText(
        /No se pudo cambiar de lugar «Todo de Ana»: No puedes editar este issue/,
      ),
    ).toBeTruthy()
    await waitFor(() =>
      expect(titlesOf('Por hacer')).toEqual([
        'Todo de Ana',
        'Todo de Luis',
        'Sin asignar',
      ]),
    )
  })

  it('restores the exact previous place by itself, without waiting for a refresh', async () => {
    const pending = deferred<IssueDto>()
    moveIssue.mockImplementationOnce((() => pending.promise) as never)
    renderBoard()
    await screen.findByText('Todo de Ana')
    await dropOn('a', 'b', true)
    await waitFor(() => expect(titlesOf('Por hacer')[0]).toBe('Todo de Luis'))

    listIssues.mockImplementation((() => new Promise(() => {})) as never) // el refresco queda colgado
    pending.reject(errorResponse('INTERNAL', 'Internal server error', 500))

    await waitFor(() =>
      expect(titlesOf('Por hacer')).toEqual([
        'Todo de Ana',
        'Todo de Luis',
        'Sin asignar',
      ]),
    )
  })

  it('only announces a move between columns, not a reorder inside one', async () => {
    renderBoard()
    await screen.findByText('Todo de Ana')

    await dropOn('a', 'b', true)
    await waitFor(() => expect(moveIssue).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(titlesOf('Por hacer')[1]).toBe('Todo de Ana'))
    expect(screen.queryByText(/pasó a/)).toBeNull()

    await dropOn('b', 'c', true)
    expect(
      await screen.findByText(/«Todo de Luis» pasó a «En progreso»/),
    ).toBeTruthy()
  })

  it('keeps the new order after reloading the page', async () => {
    renderBoard()
    await screen.findByText('Todo de Ana')
    await dropOn('a', 'e', true) // «Todo de Ana» al final
    await waitFor(() => expect(moveIssue).toHaveBeenCalled())
    await waitFor(() =>
      expect(titlesOf('Por hacer')).toEqual([
        'Todo de Luis',
        'Sin asignar',
        'Todo de Ana',
      ]),
    )
    cleanup()

    renderBoard() // "recargar": pantalla nueva, sin caché
    await screen.findByText('Progreso de Ana')
    expect(titlesOf('Por hacer')).toEqual([
      'Todo de Luis',
      'Sin asignar',
      'Todo de Ana',
    ])
  })

  it('moves a card to the top of the new column with the "Mover a" selector', async () => {
    const user = userEvent.setup()
    renderBoard()
    await screen.findByText('Todo de Ana')
    await user.selectOptions(moveSelect('Todo de Ana'), 'done')
    expect(moveIssue).toHaveBeenCalledWith({
      data: { id: 'a', status: 'done', afterId: null },
    })
    await waitFor(() =>
      expect(titlesOf('Hecho')).toEqual(['Todo de Ana', 'Hecho de Luis']),
    )
  })
})

describe('kanban board: insertion line while dragging', () => {
  const lines = () =>
    document.querySelectorAll('li[class*="after:absolute"]').length
  const topLines = () => document.querySelectorAll('li[aria-hidden]').length

  it('shows a line under the card the dragged one would go below, and removes it on drop', async () => {
    renderBoard()
    await screen.findByText('Todo de Ana')
    expect(lines()).toBe(0)

    await hoverOn('a', 'b', true) // «a» pasaría a estar debajo de «b»
    expect(lines()).toBe(1)
    const withLine = document.querySelector('li[class*="after:absolute"]')!
    expect(
      within(withLine as HTMLElement).getByText('Todo de Luis'),
    ).toBeTruthy()

    await dropOn('a', 'b', true)
    await waitFor(() => expect(lines()).toBe(0))
  })

  it('shows the line at the top of the column when it would become the first card', async () => {
    renderBoard()
    await screen.findByText('Todo de Ana')
    expect(topLines()).toBe(0)
    await hoverOn('e', 'a', false)
    expect(topLines()).toBe(1)
    expect(lines()).toBe(0)
  })

  it('shows no line when dropping would change nothing', async () => {
    renderBoard()
    await screen.findByText('Todo de Ana')
    await hoverOn('a', 'a', true)
    await hoverOn('b', 'a', true)
    expect(lines() + topLines()).toBe(0)
  })

  it('removes the line when the drag is cancelled', async () => {
    renderBoard()
    await screen.findByText('Todo de Ana')
    await hoverOn('a', 'b', true)
    expect(lines()).toBe(1)
    act(() => dnd.props.onDragCancel?.({} as never))
    expect(lines()).toBe(0)
  })
})
