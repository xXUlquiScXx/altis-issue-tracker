import type { z } from 'zod'

// Adaptador para `.validator()` de las server functions. Si le pasáramos el
// esquema directo, TanStack Start lanzaría un Error genérico y perderíamos el
// ZodError; con esta función el error llega intacto a `toErrorResponse`.
export function validate<S extends z.ZodType>(schema: S) {
  return (input: z.input<S>): z.output<S> => schema.parse(input)
}
