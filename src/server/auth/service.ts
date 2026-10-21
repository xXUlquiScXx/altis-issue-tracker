import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { organizations, users } from '@/db/schema'
import type { LoginInput, RegisterInput } from '@/lib/schemas'
import type { SessionUser } from '@/lib/types'
import { AppError } from '../errors'
import { hashPassword, verifyPassword } from './password'

const sessionUserColumns = {
  id: users.id,
  orgId: users.orgId,
  orgName: organizations.name,
  role: users.role,
  name: users.name,
  email: users.email,
}

// El rol y la org siempre se leen de la BD, nunca del token ni del cliente.
export async function findSessionUser(
  userId: string,
): Promise<SessionUser | null> {
  const [row] = await db
    .select(sessionUserColumns)
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.orgId))
    .where(eq(users.id, userId))
    .limit(1)
  return row ?? null
}

function isUniqueViolation(error: unknown) {
  // Drizzle envuelve el error del driver en `cause`.
  const e = error as { code?: string; cause?: { code?: string } }
  return (e.code ?? e.cause?.code) === '23505'
}

export async function registerUser(input: RegisterInput): Promise<SessionUser> {
  const slug = process.env.DEMO_ORG_SLUG
  if (!slug) throw new Error('DEMO_ORG_SLUG is not set')

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1)
  if (!org) throw new Error('Demo organization not found')

  const passwordHash = await hashPassword(input.password)
  try {
    // El rol es siempre 'member' y la org siempre la demo: el cliente no decide.
    const [created] = await db
      .insert(users)
      .values({
        orgId: org.id,
        email: input.email,
        name: input.name,
        passwordHash,
        role: 'member',
      })
      .returning({ id: users.id })
    if (!created) throw new Error('User insert failed')
    return {
      id: created.id,
      orgId: org.id,
      orgName: org.name,
      role: 'member',
      name: input.name,
      email: input.email,
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError('VALIDATION', 'Email already registered', {
        email: 'Email already registered',
      })
    }
    throw error
  }
}

// Hash falso: si el email no existe igual comparamos contra algo, para que
// la respuesta tarde lo mismo y no se pueda adivinar qué emails existen.
let dummyHash: Promise<string> | undefined
function getDummyHash() {
  dummyHash ??= hashPassword(randomUUID())
  return dummyHash
}

export async function loginUser(input: LoginInput): Promise<SessionUser> {
  const [row] = await db
    .select({ ...sessionUserColumns, passwordHash: users.passwordHash })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.orgId))
    .where(eq(users.email, input.email))
    .limit(1)

  const valid = await verifyPassword(
    input.password,
    row?.passwordHash ?? (await getDummyHash()),
  )
  if (!row || !valid) {
    throw new AppError('UNAUTHENTICATED', 'Invalid email or password')
  }

  // Se arma el usuario campo por campo para no devolver nunca el hash.
  return {
    id: row.id,
    orgId: row.orgId,
    orgName: row.orgName,
    role: row.role,
    name: row.name,
    email: row.email,
  }
}
