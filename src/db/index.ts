import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

// prepare: false es obligatorio con el pooler de Supabase en modo transaccion.
const client = postgres(url, { prepare: false })

export const db = drizzle(client, { schema, casing: 'snake_case' })
