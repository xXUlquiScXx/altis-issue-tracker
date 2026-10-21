import { readFileSync } from 'node:fs'
import postgres from 'postgres'
import { EVENT_TYPES } from '../lib/types'
import { describeDatabase } from './describe-database'

// Revisa una base de datos SIN modificarla (solo SELECT): a cuál apunta, si las
// migraciones están al día y si el enum del historial tiene todos sus valores.
// Sirve para comprobar producción: `pnpm db:status`.
const url = process.env.DATABASE_URL_MIGRATE
if (!url) throw new Error('DATABASE_URL_MIGRATE is not set')

const client = postgres(url, { max: 1, onnotice: () => {} })
let ok = true
try {
  console.log(`Database: ${describeDatabase(url)}`)

  // 1) Migraciones registradas en la base vs. migraciones del repositorio.
  const journal = JSON.parse(
    readFileSync('./drizzle/meta/_journal.json', 'utf8'),
  ) as { entries: unknown[] }
  const [tableRow] = await client<{ exists: boolean }[]>`
    select to_regclass('drizzle.__drizzle_migrations') is not null as exists`
  const applied = tableRow?.exists
    ? ((
        await client`select count(*)::int as n from drizzle.__drizzle_migrations`
      )[0]?.n as number)
    : 0
  const migrationsOk = applied === journal.entries.length
  console.log(
    `Migrations: ${applied} of ${journal.entries.length} applied ${migrationsOk ? 'OK' : '<-- MISSING: run pnpm db:migrate'}`,
  )
  ok &&= migrationsOk

  // Si la base aún no se migró, no existen ni el enum ni las tablas.
  const [typeRow] = await client<{ exists: boolean }[]>`
    select to_regtype('event_type') is not null as exists`
  if (!typeRow?.exists) {
    console.log('event_type: does not exist <-- run pnpm db:migrate')
    console.log('Rows: tables not created yet')
    ok = false
  } else {
    // 2) Valores del enum del historial vs. los que usa el código.
    const enumRows = await client<{ value: string }[]>`
      select unnest(enum_range(null::event_type))::text as value`
    const inDb = enumRows.map((row) => row.value)
    const missing = EVENT_TYPES.filter((type) => !inDb.includes(type))
    console.log(
      `event_type: ${inDb.length} values (${inDb.join(', ')}) ${missing.length === 0 ? 'OK' : `<-- MISSING: ${missing.join(', ')}`}`,
    )
    ok &&= missing.length === 0

    // 3) Cuántos datos hay (para saber si es una base vacía o ya sembrada).
    const [counts] = await client`
      select (select count(*) from organizations)::int as organizations,
             (select count(*) from users)::int as users,
             (select count(*) from issues)::int as issues,
             (select count(*) from comments)::int as comments,
             (select count(*) from issue_events)::int as events`
    console.log(
      `Rows: ${Object.entries(counts ?? {})
        .map(([table, n]) => `${table} ${n}`)
        .join(', ')}`,
    )
  }
} finally {
  await client.end()
}

if (!ok) {
  console.error('Status: NOT up to date')
  process.exit(1)
}
console.log('Status: up to date')
