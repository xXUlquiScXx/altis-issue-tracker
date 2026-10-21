import { describeDatabase } from './describe-database'
import { runMigrations } from './run-migrations'

const url = process.env.DATABASE_URL_MIGRATE
if (!url) throw new Error('DATABASE_URL_MIGRATE is not set')

const { applied, total } = await runMigrations(url)
console.log(
  `Migrations up to date on ${describeDatabase(url)}: ${applied} of ${total}`,
)
if (applied < total)
  throw new Error('Some migrations are missing in the database')
