import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError, api, isApiError } from '@/lib/api'
import { createQueryClient } from '@/lib/query-client'
import { apiErrorMessage, translate, translateFields } from '@/lib/messages'
import {
  createCommentSchema,
  createIssueSchema,
  loginSchema,
  registerSchema,
  updateCommentSchema,
} from '@/lib/schemas'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
const { toast } = await import('sonner')

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('api()', () => {
  it('returns the result when the call succeeds', async () => {
    await expect(api(() => Promise.resolve(42))).resolves.toBe(42)
  })

  it('turns an error Response from the server into an ApiRequestError', async () => {
    const failing = () =>
      Promise.reject(
        Response.json(
          {
            error: {
              code: 'VALIDATION',
              message: 'Invalid input',
              fields: { title: 'Title is required' },
            },
          },
          { status: 400 },
        ),
      )
    const error = await api(failing).catch((e: unknown) => e)

    expect(isApiError(error, 'VALIDATION')).toBe(true)
    expect(error).toMatchObject({
      code: 'VALIDATION',
      status: 400,
      fields: { title: 'Title is required' },
    })
    expect(error).toBeInstanceOf(ApiRequestError)
  })

  it('treats network errors and non-JSON responses as INTERNAL', async () => {
    const network = await api(() =>
      Promise.reject(new TypeError('fetch failed')),
    ).catch((e: unknown) => e)
    const html = await api(() =>
      Promise.reject(new Response('<html>', { status: 502 })),
    ).catch((e: unknown) => e)
    expect(network).toMatchObject({ code: 'INTERNAL' })
    expect(html).toMatchObject({ code: 'INTERNAL' })
  })
})

describe('createQueryClient() central error handling', () => {
  let onUnauthenticated: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    onUnauthenticated = vi.fn<() => void>()
  })

  const failWith = (code: string, message: string, status: number) => () =>
    api(() => Promise.reject(errorResponse(code, message, status)))

  it('on 401 from a query: clears the cache, warns once and goes to login', async () => {
    const client = createQueryClient(onUnauthenticated)
    client.setQueryData(['private'], 'secret')

    // Dos consultas fallan a la vez: solo se atiende una vez.
    await Promise.allSettled([
      client.fetchQuery({
        queryKey: ['a'],
        queryFn: failWith('UNAUTHENTICATED', 'Authentication required', 401),
      }),
      client.fetchQuery({
        queryKey: ['b'],
        queryFn: failWith('UNAUTHENTICATED', 'Authentication required', 401),
      }),
    ])

    expect(onUnauthenticated).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(client.getQueryData(['private'])).toBeUndefined()
  })

  it('on 403 from a mutation: shows a toast in Spanish and stays on the page', async () => {
    const client = createQueryClient(onUnauthenticated)
    await client
      .getMutationCache()
      .build(client, {
        mutationFn: failWith('FORBIDDEN', 'You cannot edit this issue', 403),
      })
      .execute(undefined)
      .catch(() => undefined)

    expect(toast.error).toHaveBeenCalledWith('No puedes editar este issue')
    expect(onUnauthenticated).not.toHaveBeenCalled()
  })

  it('on 500 from a mutation: shows the generic server message', async () => {
    const client = createQueryClient(onUnauthenticated)
    await client
      .getMutationCache()
      .build(client, {
        mutationFn: failWith('INTERNAL', 'Internal server error', 500),
      })
      .execute(undefined)
      .catch(() => undefined)

    expect(toast.error).toHaveBeenCalledWith(
      'Ocurrió un error en el servidor. Intenta de nuevo',
    )
  })

  it('on 401 from a mutation: goes to login', async () => {
    const client = createQueryClient(onUnauthenticated)
    await client
      .getMutationCache()
      .build(client, {
        mutationFn: failWith('UNAUTHENTICATED', 'Authentication required', 401),
      })
      .execute(undefined)
      .catch(() => undefined)

    expect(onUnauthenticated).toHaveBeenCalledTimes(1)
  })

  it('leaves 403 and 404 from a query to the view (no toast, no redirect)', async () => {
    const client = createQueryClient(onUnauthenticated)
    await Promise.allSettled([
      client.fetchQuery({
        queryKey: ['a'],
        queryFn: failWith('FORBIDDEN', 'x', 403),
      }),
      client.fetchQuery({
        queryKey: ['b'],
        queryFn: failWith('NOT_FOUND', 'Issue not found', 404),
      }),
    ])
    expect(toast.error).not.toHaveBeenCalled()
    expect(onUnauthenticated).not.toHaveBeenCalled()
  })

  it('retries once only when the failure may be temporary', () => {
    const retry = createQueryClient(onUnauthenticated).getDefaultOptions()
      .queries!.retry as (count: number, error: Error) => boolean

    expect(retry(0, new ApiRequestError('NOT_FOUND', 'x'))).toBe(false)
    expect(retry(0, new ApiRequestError('FORBIDDEN', 'x'))).toBe(false)
    expect(retry(0, new ApiRequestError('INTERNAL', 'x'))).toBe(true)
    expect(retry(1, new ApiRequestError('INTERNAL', 'x'))).toBe(false)
    expect(retry(0, new TypeError('network'))).toBe(true)
  })
})

describe('messages in Spanish', () => {
  it('translates known messages and falls back by error code', () => {
    expect(
      apiErrorMessage({ code: 'NOT_FOUND', message: 'Issue not found' }),
    ).toBe('El issue no existe o no tienes acceso a él')
    expect(
      apiErrorMessage({
        code: 'FORBIDDEN',
        message: 'algo nuevo sin traducir',
      }),
    ).toBe('No tienes permiso para hacer esto')
    expect(
      translateFields({ title: 'Title is required', zzz: 'raro' }),
    ).toEqual({
      title: 'El título es obligatorio',
      zzz: 'El valor no es válido',
    })
  })

  // Si alguien agrega un mensaje de error nuevo al servidor y olvida
  // traducirlo, este test falla y avisa cuál es.
  it('has a translation for every message the server can send', () => {
    const untranslated = (message: string) =>
      translate(message) === translate('__no existe__')

    const missing = new Set<string>()

    // 1) Mensajes de AppError escritos en el código del servidor.
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (path.endsWith('.ts')) files.push(path)
      }
    }
    walk(join(process.cwd(), 'src/server'))
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(
        /new AppError\(\s*'[A-Z_]+',\s*'([^']+)'/g,
      )) {
        if (untranslated(match[1]!)) missing.add(match[1]!)
      }
    }

    // 2) Mensajes de validación de zod, provocándolos con datos inválidos.
    const long = (n: number) => 'a'.repeat(n)
    const results = [
      registerSchema.safeParse({ name: '', email: 'x', password: '1' }),
      registerSchema.safeParse({
        name: long(101),
        email: `${long(250)}@x.com`,
        password: long(73),
      }),
      loginSchema.safeParse({ email: 'x', password: '' }),
      createIssueSchema.safeParse({ title: '' }),
      createIssueSchema.safeParse({
        title: long(201),
        description: long(10_001),
        labels: [
          '',
          long(31),
          ...Array.from({ length: 10 }, (_, i) => `l${i}`),
        ],
      }),
      createCommentSchema.safeParse({ issueId: 'abc', body: '' }),
      updateCommentSchema.safeParse({ id: 'abc', body: long(5_001) }),
    ]
    for (const result of results) {
      if (result.success) continue
      for (const issue of result.error.issues) {
        if (untranslated(issue.message)) missing.add(issue.message)
      }
    }

    expect([...missing]).toEqual([])
  })
})
