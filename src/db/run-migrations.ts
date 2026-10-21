import { readFileSync } from 'node:fs'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

// Aplica las migraciones pendientes y devuelve cuántas hay registradas en la
// base y cuántas hay en el repositorio (deberían coincidir).
export async function runMigrations(url: string) {
  // onnotice vacío: Postgres avisa "ya existe, se omite", que solo confunde.
  const client = postgres(url, { max: 1, onnotice: () => {} })
  try {
    await migrate(drizzle(client), { migrationsFolder: './drizzle' })
    const [row] = await client`
      select count(*)::int as applied from drizzle.__drizzle_migrations`
    const journal = JSON.parse(
      readFileSync('./drizzle/meta/_journal.json', 'utf8'),
    ) as { entries: unknown[] }
    return { applied: row?.applied ?? 0, total: journal.entries.length }
  } finally {
    await client.end()
  }
}
