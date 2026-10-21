// @vitest-environment node
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { loginSchema, registerSchema } from '@/lib/schemas'

// Usan un Postgres real y aislado (TEST_DATABASE_URL); sin esa variable se omiten.
const hasTestDb = Boolean(process.env.TEST_DATABASE_URL)

type AuthService = typeof import('@/server/auth/service')
type Fixtures = Awaited<
  ReturnType<typeof import('../helpers/fixtures').resetAndSeedFixtures>
>

describe.skipIf(!hasTestDb)('registration and login', () => {
  let auth: AuthService
  let f: Fixtures

  beforeEach(async () => {
    // El registro siempre cae en la organización demo.
    process.env.DEMO_ORG_SLUG = 'acme'
    auth = await import('@/server/auth/service')
    const { resetAndSeedFixtures } = await import('../helpers/fixtures')
    f = await resetAndSeedFixtures()
  })

  const register = (input: Record<string, unknown>) =>
    auth.registerUser(registerSchema.parse(input))
  const login = (input: Record<string, unknown>) =>
    auth.loginUser(loginSchema.parse(input))
  const rowOf = async (email: string) => {
    const { db } = await import('@/db')
    const { users } = await import('@/db/schema')
    return (await db.select().from(users).where(eq(users.email, email)))[0]
  }

  describe('registration', () => {
    it('never creates an admin, nor lets the client pick the organization', async () => {
      // El cliente intenta colarse como admin de Beta.
      const created = await register({
        name: 'Intruso',
        email: 'intruso@acme.test',
        password: 'Secret123',
        role: 'admin',
        orgId: f.betaAdmin.orgId,
      })

      expect(created).toMatchObject({
        role: 'member',
        orgName: 'Acme',
        orgId: f.acmeAdmin.orgId,
      })
      // Y es lo que quedó guardado, no solo lo que se devolvió.
      expect(await rowOf('intruso@acme.test')).toMatchObject({
        role: 'member',
        orgId: f.acmeAdmin.orgId,
      })
    })

    it('stores the email in lowercase and refuses a repeated one, whatever its case', async () => {
      const created = await register({
        name: 'Ana',
        email: '  NUEVA@Acme.TEST ',
        password: 'Secret123',
      })
      expect(created.email).toBe('nueva@acme.test')

      await expect(
        register({
          name: 'Otra',
          email: 'nueva@ACME.test',
          password: 'Secret123',
        }),
      ).rejects.toMatchObject({
        code: 'VALIDATION',
        fields: { email: 'Email already registered' },
      })
    })

    it('stores the password as a hash, never as plain text', async () => {
      await register({
        name: 'Ana',
        email: 'hash@acme.test',
        password: 'Secret123',
      })
      const row = await rowOf('hash@acme.test')
      expect(row?.passwordHash).not.toContain('Secret123')
      expect(row?.passwordHash).toMatch(/^\$2[aby]\$/)
    })

    it('returns the user without any password data', async () => {
      const created = await register({
        name: 'Ana',
        email: 'limpio@acme.test',
        password: 'Secret123',
      })
      expect(Object.keys(created).sort()).toEqual([
        'email',
        'id',
        'name',
        'orgId',
        'orgName',
        'role',
      ])
    })
  })

  describe('login', () => {
    it('lets a registered user in and returns them without the hash', async () => {
      await register({
        name: 'Ana',
        email: 'ana2@acme.test',
        password: 'Secret123',
      })
      const user = await login({
        email: 'ANA2@acme.test',
        password: 'Secret123',
      })
      expect(user).toMatchObject({
        email: 'ana2@acme.test',
        role: 'member',
        orgName: 'Acme',
      })
      expect(user).not.toHaveProperty('passwordHash')
    })

    it('answers the same thing for a wrong password and for an email that does not exist', async () => {
      await register({
        name: 'Ana',
        email: 'existe@acme.test',
        password: 'Secret123',
      })

      const wrongPassword = await login({
        email: 'existe@acme.test',
        password: 'OtraClave1',
      }).catch((e: unknown) => e)
      const unknownEmail = await login({
        email: 'nadie@acme.test',
        password: 'OtraClave1',
      }).catch((e: unknown) => e)

      // Misma respuesta: no se puede averiguar qué correos están registrados.
      for (const error of [wrongPassword, unknownEmail]) {
        expect(error).toMatchObject({
          code: 'UNAUTHENTICATED',
          message: 'Invalid email or password',
        })
      }
    })
  })
})
