import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  // Solo hace falta para push/studio; `generate` no se conecta a la BD.
  dbCredentials: { url: process.env.DATABASE_URL_MIGRATE ?? '' },
  // Las columnas se escriben en camelCase en TS y quedan en snake_case en SQL.
  casing: 'snake_case',
})
