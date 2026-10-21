import { z } from 'zod'

// Toma el primer mensaje de cada campo de un error de zod: { email: 'Invalid email' }.
export function fieldErrorsFrom(error: z.ZodError) {
  // El tipo genérico de ZodError no conoce los campos, por eso el cast.
  const fieldErrors = z.flattenError(error).fieldErrors as Record<
    string,
    string[] | undefined
  >
  const fields: Record<string, string> = {}
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (messages?.[0]) fields[field] = messages[0]
  }
  return fields
}
