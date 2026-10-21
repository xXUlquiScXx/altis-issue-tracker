import { z } from 'zod'

// Estos esquemas se usan en el cliente (feedback rápido) y en el servidor
// (la validación que realmente protege). Cualquier campo extra, como `role`
// u `orgId`, se descarta: zod ignora las llaves que no declaramos.
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Invalid email').max(254, 'Email is too long'))

// bcrypt solo usa los primeros 72 caracteres de la contraseña.
const passwordSchema = z.string().max(72, 'Password is too long')

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name is too long'),
  email: emailSchema,
  password: passwordSchema.min(8, 'Password must have at least 8 characters'),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema.min(1, 'Password is required'),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
