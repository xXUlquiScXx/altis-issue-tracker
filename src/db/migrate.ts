import { runMigrations } from './run-migrations'

const url = process.env.DATABASE_URL_MIGRATE
if (!url) throw new Error('DATABASE_URL_MIGRATE is not set')

await runMigrations(url)
console.log('Migrations applied')
