// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/server/errors'
import type { SessionUser } from '@/lib/types'

// El usuario de la petición lo decide `getSessionUser` (cookie + BD). Aquí se
// simula "sin sesión" y "con sesión" para probar las reglas que vienen después.
vi.mock('@/server/auth/current-user', () => ({ getSessionUser: vi.fn() }))
const { getSessionUser } = vi.mocked(await import('@/server/auth/current-user'))
const { errorMiddleware, requireUser } = await import('@/server/middleware')

// Los middleware guardan su lógica en `.options.server`; se llama directamente.
type ServerStep = (ctx: {
  next: (arg?: unknown) => unknown
}) => Promise<unknown>
const serverStep = (middleware: unknown) =>
  (middleware as { options: { server: ServerStep } }).options.server

const user: SessionUser = {
  id: 'u1',
  orgId: 'o1',
  orgName: 'Acme',
  role: 'member',
  name: 'Ana',
  email: 'ana@acme.test',
}

describe('requireUser: no session, no access', () => {
  const run = serverStep(requireUser)
  beforeEach(() => vi.mocked(getSessionUser).mockReset())

  it('rejects with UNAUTHENTICATED and never reaches the handler when there is no session', async () => {
    getSessionUser.mockResolvedValue(null)
    const next = vi.fn()

    await expect(run({ next })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    await expect(run({ next })).rejects.toBeInstanceOf(AppError)
    expect(next).not.toHaveBeenCalled()
  })

  it('lets the request through with the user in the context when the session is valid', async () => {
    getSessionUser.mockResolvedValue(user)
    const next = vi.fn().mockResolvedValue('resultado')

    await expect(run({ next })).resolves.toBe('resultado')
    expect(next).toHaveBeenCalledWith({ context: { user } })
  })

  it('depends on errorMiddleware, so its error reaches the client as a clean 401', () => {
    const chain = (
      requireUser as unknown as { options: { middleware: unknown[] } }
    ).options.middleware
    expect(chain).toContain(errorMiddleware)
  })
})

describe('errorMiddleware: every failure becomes a consistent JSON response', () => {
  const run = serverStep(errorMiddleware)
  const fail = (error: unknown) => run({ next: () => Promise.reject(error) })

  // Lo que atrapa el middleware es lo que se lanza: una Response.
  async function caught(error: unknown) {
    const response = (await fail(error).catch((e: unknown) => e)) as Response
    return { status: response.status, body: await response.json() }
  }

  beforeEach(() =>
    vi.spyOn(console, 'error').mockImplementation(() => undefined),
  )
  afterEach(() => vi.restoreAllMocks())

  it('turns UNAUTHENTICATED into 401', async () => {
    const { status, body } = await caught(
      new AppError('UNAUTHENTICATED', 'Authentication required'),
    )
    expect(status).toBe(401)
    expect(body).toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    })
  })

  it.each([
    ['FORBIDDEN', 403],
    ['NOT_FOUND', 404],
    ['VALIDATION', 400],
    ['RATE_LIMITED', 429],
  ] as const)('maps %s to HTTP %i', async (code, expected) => {
    expect((await caught(new AppError(code, 'x'))).status).toBe(expected)
  })

  it('turns an invalid input (zod) into 400 VALIDATION with the failing fields', async () => {
    const result = z
      .object({ title: z.string().min(1, 'Title is required') })
      .safeParse({ title: '' })
    const { status, body } = await caught(result.error)
    expect(status).toBe(400)
    expect(body.error).toMatchObject({
      code: 'VALIDATION',
      fields: { title: 'Title is required' },
    })
  })

  it('hides internal details of unexpected errors (no stack, no SQL)', async () => {
    const { status, body } = await caught(
      new Error(
        'select * from users where password_hash = ... connection refused at db.internal:5432',
      ),
    )
    expect(status).toBe(500)
    expect(body).toEqual({
      error: { code: 'INTERNAL', message: 'Internal server error' },
    })
    expect(JSON.stringify(body)).not.toMatch(
      /select|password|db\.internal|at /i,
    )
  })

  it('lets successful results and framework responses through untouched', async () => {
    await expect(run({ next: () => Promise.resolve('ok') })).resolves.toBe('ok')
    const redirect = new Response(null, {
      status: 307,
      headers: { location: '/login' },
    })
    await expect(fail(redirect)).rejects.toBe(redirect)
  })
})

describe('policy: every server function requires a session, except the public ones', () => {
  // Las únicas funciones que se pueden llamar sin sesión, a propósito.
  const PUBLIC = ['register', 'login', 'logout']

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return sourceFiles(path)
      return /\.(ts|tsx)$/.test(name) ? [path] : []
    })
  }
  const files = sourceFiles(join(process.cwd(), 'src'))

  // Cada `export const nombre = createServerFn(...)...` con su cadena completa.
  const serverFns = files
    .filter((file) => readFileSync(file, 'utf8').includes('createServerFn('))
    .flatMap((file) => {
      const source = readFileSync(file, 'utf8')
      const starts = [
        ...source.matchAll(/export const (\w+) = createServerFn\(/g),
      ]
      return starts.map((match, i) => ({
        file: file.replace(process.cwd() + '/', ''),
        name: match[1]!,
        code: source.slice(match.index, starts[i + 1]?.index ?? source.length),
      }))
    })

  it('finds the server functions (so this test cannot pass by finding nothing)', () => {
    const names = serverFns.map((fn) => fn.name)
    for (const expected of [
      ...PUBLIC,
      'getMe',
      'listIssues',
      'createIssue',
      'updateIssue',
      'deleteIssue',
      'listIssueEvents',
      'listComments',
      'createComment',
      'updateComment',
      'deleteComment',
      'listOrgUsers',
    ]) {
      expect(names).toContain(expected)
    }
  })

  it('only defines server functions inside src/server/**/functions.ts, where this test looks', () => {
    for (const fn of serverFns)
      expect(fn.file).toMatch(/^src\/server\/.+\/functions\.ts$/)
  })

  it('protects every non-public server function with requireUser', () => {
    const unprotected = serverFns
      .filter((fn) => !PUBLIC.includes(fn.name))
      .filter((fn) => !fn.code.includes('.middleware([requireUser])'))
      .map((fn) => fn.name)
    expect(unprotected).toEqual([])
  })

  it('gives the public ones at least the error middleware, so failures are clean', () => {
    for (const fn of serverFns.filter((f) => PUBLIC.includes(f.name))) {
      expect(fn.code, fn.name).toContain('.middleware([errorMiddleware])')
    }
  })

  it('does not let a public function sneak in without being listed', () => {
    const noSession = serverFns
      .filter((fn) => !fn.code.includes('requireUser'))
      .map((fn) => fn.name)
      .sort()
    expect(noSession).toEqual([...PUBLIC].sort())
  })
})
