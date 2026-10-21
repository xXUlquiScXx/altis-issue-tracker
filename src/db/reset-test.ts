import postgres from 'postgres'
import { runMigrations } from './run-migrations'

const testUrl = process.env.TEST_DATABASE_URL
if (!testUrl) throw new Error('TEST_DATABASE_URL is not set')

// Guard: jamas tocar la BD real. Si la URL de test coincide con alguna de las
// URLs de produccion, se aborta antes de conectar.
const protectedUrls = [
  process.env.DATABASE_URL,
  process.env.DATABASE_URL_MIGRATE,
].filter(Boolean)
if (protectedUrls.includes(testUrl)) {
  throw new Error('TEST_DATABASE_URL must not match a production database URL')
}

await runMigrations(testUrl)

const client = postgres(testUrl, { max: 1 })
try {
  await client`TRUNCATE organizations, users, issues, comments, issue_events RESTART IDENTITY CASCADE`
  console.log('Test database reset')
} finally {
  await client.end()
}
