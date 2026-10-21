import { createFileRoute } from '@tanstack/react-router'
import { sql } from 'drizzle-orm'

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        try {
          // Import dinámico: así el módulo de BD solo se carga al llamar al endpoint.
          const { db } = await import('@/db')
          await db.execute(sql`select 1`)
          return Response.json({ status: 'ok', db: 'ok' })
        } catch (error) {
          // El detalle solo va al log del servidor, nunca a la respuesta.
          console.error('Health check failed', error)
          return Response.json(
            { error: { code: 'INTERNAL', message: 'Database unavailable' } },
            { status: 500 },
          )
        }
      },
    },
  },
})
