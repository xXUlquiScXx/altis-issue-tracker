import { z } from 'zod'
import { PRIORITIES, STATUSES } from './types'

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

// ---- Issues ----

export const statusSchema = z.enum(STATUSES)
export const prioritySchema = z.enum(PRIORITIES)

const titleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(200, 'Title is too long')

const descriptionSchema = z.string().max(10_000, 'Description is too long')

// Cada label se recorta; las repetidas se descartan.
const labelsSchema = z
  .array(
    z.string().trim().min(1, 'Label is empty').max(30, 'Label is too long'),
  )
  .max(10, 'Too many labels')
  .transform((labels) => [...new Set(labels)])

export const createIssueSchema = z.object({
  title: titleSchema,
  description: descriptionSchema.optional(),
  status: statusSchema.default('todo'),
  priority: prioritySchema.default('med'),
  // Solo lo respeta el admin; el member siempre queda como assignee.
  assigneeId: z.uuid().nullish(),
  labels: labelsSchema.default([]),
})

// Solo se cambian los campos que vienen en la petición.
export const updateIssueSchema = z.object({
  id: z.uuid(),
  title: titleSchema.optional(),
  description: descriptionSchema.nullable().optional(),
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  assigneeId: z.uuid().nullable().optional(),
  labels: labelsSchema.optional(),
})

export const issueIdSchema = z.object({ id: z.uuid() })

export const listIssuesSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  // Un id de usuario, o 'unassigned' para los que no tienen responsable.
  assignee: z.union([z.uuid(), z.literal('unassigned')]).optional(),
  q: z.string().trim().max(100).optional(),
})

export type CreateIssueInput = z.infer<typeof createIssueSchema>
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>
export type ListIssuesInput = z.infer<typeof listIssuesSchema>
