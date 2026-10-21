import { defineConfig } from 'vitest/config'

const testDatabaseUrl = process.env.TEST_DATABASE_URL

// Guard: los tests jamás pueden apuntar a la base de producción.
if (
  testDatabaseUrl &&
  [process.env.DATABASE_URL, process.env.DATABASE_URL_MIGRATE].includes(
    testDatabaseUrl,
  )
) {
  throw new Error('TEST_DATABASE_URL must not match a production database URL')
}

// Config aparte de vite.config.ts para no cargar los plugins de TanStack Start en los tests.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    // Los tests de BD comparten una sola base: se ejecutan de a un archivo.
    fileParallelism: false,
    // Dentro de los tests, `@/db` solo ve la BD de pruebas (o ninguna).
    env: {
      DATABASE_URL: testDatabaseUrl ?? '',
      DATABASE_URL_MIGRATE: '',
    },
  },
})
