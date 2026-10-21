import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { organizations, users } from '@/db/schema'
import type { SessionUser } from '@/lib/types'

// Vacía la BD de pruebas y crea 2 orgs con usuarios conocidos.
// Importante: este archivo solo se importa de forma dinámica, después de
// comprobar que existe TEST_DATABASE_URL.
export async function resetAndSeedFixtures() {
  await db.execute(
    sql`TRUNCATE organizations, users, issues, comments, issue_events RESTART IDENTITY CASCADE`,
  )

  const [acme, beta] = await db
    .insert(organizations)
    .values([
      { name: 'Acme', slug: 'acme' },
      { name: 'Beta', slug: 'beta' },
    ])
    .returning()
  if (!acme || !beta) throw new Error('Fixture orgs failed')

  const passwordHash = 'not-a-real-hash'
  const rows = await db
    .insert(users)
    .values([
      {
        orgId: acme.id,
        email: 'admin@acme.test',
        name: 'Alicia',
        role: 'admin',
        passwordHash,
      },
      {
        orgId: acme.id,
        email: 'ana@acme.test',
        name: 'Ana',
        role: 'member',
        passwordHash,
      },
      {
        orgId: acme.id,
        email: 'luis@acme.test',
        name: 'Luis',
        role: 'member',
        passwordHash,
      },
      {
        orgId: beta.id,
        email: 'admin@beta.test',
        name: 'Bruno',
        role: 'admin',
        passwordHash,
      },
      {
        orgId: beta.id,
        email: 'bea@beta.test',
        name: 'Bea',
        role: 'member',
        passwordHash,
      },
    ])
    .returning()

  const toSessionUser = (index: number, orgName: string): SessionUser => {
    const row = rows[index]
    if (!row) throw new Error('Fixture user missing')
    return {
      id: row.id,
      orgId: row.orgId,
      orgName,
      role: row.role,
      name: row.name,
      email: row.email,
    }
  }

  return {
    acmeAdmin: toSessionUser(0, 'Acme'),
    ana: toSessionUser(1, 'Acme'),
    luis: toSessionUser(2, 'Acme'),
    betaAdmin: toSessionUser(3, 'Beta'),
    bea: toSessionUser(4, 'Beta'),
  }
}
