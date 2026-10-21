import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IssueComments } from '@/components/issues/issue-comments'
import type { CommentDto, SessionUser } from '@/lib/types'

vi.mock('@/server/comments/functions', () => ({
  listComments: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
}))
const fns = await import('@/server/comments/functions')
const listComments = vi.mocked(fns.listComments)
const createComment = vi.mocked(fns.createComment)
const updateComment = vi.mocked(fns.updateComment)
const deleteComment = vi.mocked(fns.deleteComment)

const ORG = 'org-1'
// Los esquemas exigen UUID válidos, igual que en la app real.
const ISSUE = '11111111-1111-4111-8111-111111111111'
const C1 = '22222222-2222-4222-8222-222222222222'
const C2 = '33333333-3333-4333-8333-333333333333'
const ana: SessionUser = {
  id: 'u-ana',
  orgId: ORG,
  orgName: 'Acme',
  role: 'member',
  name: 'Ana',
  email: 'a@a.test',
}
const admin: SessionUser = {
  id: 'u-admin',
  orgId: ORG,
  orgName: 'Acme',
  role: 'admin',
  name: 'Alicia',
  email: 'al@a.test',
}

const created = new Date(2026, 9, 1, 10, 0)
const comments: CommentDto[] = [
  {
    id: C1,
    issueId: ISSUE,
    authorId: 'u-ana',
    authorName: 'Ana',
    body: 'Lo **reviso** hoy',
    createdAt: created,
    updatedAt: created,
  },
  {
    id: C2,
    issueId: ISSUE,
    authorId: 'u-luis',
    authorName: 'Luis',
    body: 'Probé en producción',
    createdAt: created,
    updatedAt: new Date(2026, 9, 1, 12, 0),
  },
]

function renderComments(user: SessionUser = ana) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <IssueComments issueId={ISSUE} user={user} />
    </QueryClientProvider>,
  )
}

const errorResponse = (
  code: string,
  message: string,
  status: number,
  fields?: Record<string, string>,
) => Response.json({ error: { code, message, fields } }, { status })

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('IssueComments: listing', () => {
  it('shows a loading state and then the comments with author, date and Markdown', async () => {
    listComments.mockResolvedValue(comments)
    const { container } = renderComments()
    expect(screen.getByLabelText('Cargando comentarios')).toBeTruthy()

    expect(await screen.findByText('Probé en producción')).toBeTruthy()
    expect(screen.getByText('Comentarios (2)')).toBeTruthy()
    expect(screen.getByText('Luis')).toBeTruthy()
    expect(container.querySelector('strong')?.textContent).toBe('reviso')
    expect(listComments).toHaveBeenCalledWith({ data: { issueId: ISSUE } })
  })

  it('marks as edited only the comments whose update date is later', async () => {
    listComments.mockResolvedValue(comments)
    renderComments()
    await screen.findByText('Probé en producción')
    expect(screen.getAllByText(/· editado/)).toHaveLength(1)
  })

  it('shows an empty state when there are no comments', async () => {
    listComments.mockResolvedValue([])
    renderComments()
    expect(
      await screen.findByText('Aún no hay comentarios. Escribe el primero.'),
    ).toBeTruthy()
  })

  it('shows an error with a retry button when the server fails', async () => {
    const user = userEvent.setup()
    listComments.mockRejectedValueOnce(
      errorResponse('INTERNAL', 'Internal server error', 500),
    )
    listComments.mockResolvedValue(comments)
    renderComments()

    const alert = await screen.findByRole('alert')
    expect(
      within(alert).getByText('No se pudieron cargar los comentarios'),
    ).toBeTruthy()
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Probé en producción')).toBeTruthy()
  })
})

describe('IssueComments: creating', () => {
  it('publishes a trimmed comment, clears the box and reloads the list', async () => {
    const user = userEvent.setup()
    listComments.mockResolvedValue([])
    createComment.mockResolvedValue(comments[0]!)
    renderComments()
    await screen.findByText(/Aún no hay comentarios/)

    const box = screen.getByLabelText('Nuevo comentario') as HTMLTextAreaElement
    await user.type(box, '   Nuevo aporte   ')
    await user.click(screen.getByRole('button', { name: 'Comentar' }))

    await waitFor(() =>
      expect(createComment).toHaveBeenCalledWith({
        data: { issueId: ISSUE, body: 'Nuevo aporte' },
      }),
    )
    await waitFor(() => expect(box.value).toBe(''))
    await waitFor(() =>
      expect(listComments.mock.calls.length).toBeGreaterThan(1),
    )
  })

  it('does not call the server with an empty comment', async () => {
    const user = userEvent.setup()
    listComments.mockResolvedValue([])
    renderComments()
    await screen.findByText(/Aún no hay comentarios/)

    await user.type(screen.getByLabelText('Nuevo comentario'), '   ')
    await user.click(screen.getByRole('button', { name: 'Comentar' }))

    expect(
      await screen.findByText('El comentario no puede estar vacío'),
    ).toBeTruthy()
    expect(createComment).not.toHaveBeenCalled()
  })

  it('shows the validation error the server sends, in Spanish, and keeps the text', async () => {
    const user = userEvent.setup()
    listComments.mockResolvedValue([])
    createComment.mockRejectedValue(
      errorResponse('VALIDATION', 'Invalid input', 400, {
        body: 'Comment is too long',
      }),
    )
    renderComments()
    await screen.findByText(/Aún no hay comentarios/)

    const box = screen.getByLabelText('Nuevo comentario') as HTMLTextAreaElement
    await user.type(box, 'texto')
    await user.click(screen.getByRole('button', { name: 'Comentar' }))

    expect(
      await screen.findByText('El comentario es demasiado largo'),
    ).toBeTruthy()
    expect(box.value).toBe('texto')
  })
})

describe('IssueComments: only the author can edit or delete', () => {
  it('shows edit and delete only on the comments written by the current user', async () => {
    listComments.mockResolvedValue(comments)
    renderComments(ana)
    await screen.findByText('Probé en producción')

    expect(
      screen.getByRole('button', { name: 'Editar comentario de Ana' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Eliminar comentario de Ana' }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /de Luis/ })).toBeNull()
  })

  it('does not show edit or delete to an admin on comments by someone else', async () => {
    listComments.mockResolvedValue(comments)
    renderComments(admin)
    await screen.findByText('Probé en producción')

    expect(
      screen.queryByRole('button', { name: /Editar comentario/ }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: /Eliminar comentario/ }),
    ).toBeNull()
  })

  it('edits a comment: the box starts with the current text and saving sends the new one', async () => {
    const user = userEvent.setup()
    listComments.mockResolvedValue(comments)
    updateComment.mockResolvedValue(comments[0]!)
    renderComments(ana)
    await screen.findByText('Probé en producción')

    await user.click(
      screen.getByRole('button', { name: 'Editar comentario de Ana' }),
    )
    const box = screen.getByLabelText(
      'Editar comentario',
    ) as HTMLTextAreaElement
    expect(box.value).toBe('Lo **reviso** hoy')

    await user.clear(box)
    await user.type(box, 'Texto corregido')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(updateComment).toHaveBeenCalledWith({
        data: { id: C1, body: 'Texto corregido' },
      }),
    )
    await waitFor(() =>
      expect(screen.queryByLabelText('Editar comentario')).toBeNull(),
    )
  })

  it('cancels an edit without calling the server', async () => {
    const user = userEvent.setup()
    listComments.mockResolvedValue(comments)
    renderComments(ana)
    await screen.findByText('Probé en producción')

    await user.click(
      screen.getByRole('button', { name: 'Editar comentario de Ana' }),
    )
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(updateComment).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Editar comentario')).toBeNull()
  })

  it('deletes a comment only after confirming', async () => {
    const user = userEvent.setup()
    listComments.mockResolvedValue(comments)
    deleteComment.mockResolvedValue({ id: C1 })
    renderComments(ana)
    await screen.findByText('Probé en producción')

    await user.click(
      screen.getByRole('button', { name: 'Eliminar comentario de Ana' }),
    )
    expect(screen.getByText('¿Eliminar este comentario?')).toBeTruthy()
    expect(deleteComment).not.toHaveBeenCalled()

    // Cancelar no borra nada.
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(deleteComment).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole('button', { name: 'Eliminar comentario de Ana' }),
    )
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    await waitFor(() =>
      expect(deleteComment).toHaveBeenCalledWith({ data: { id: C1 } }),
    )
  })
})
