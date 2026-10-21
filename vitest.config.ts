import { defineConfig } from 'vitest/config'

// Config aparte de vite.config.ts para no cargar los plugins de TanStack Start en los tests.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
})
