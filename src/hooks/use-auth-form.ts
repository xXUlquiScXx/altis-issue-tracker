import { useNavigate, useRouter } from '@tanstack/react-router'
import { useState, type SubmitEvent } from 'react'
import type { z } from 'zod'
import { parseApiError } from '@/lib/api-error'
import { fieldErrorsFrom } from '@/lib/forms'
import { apiErrorMessage, translateFields } from '@/lib/messages'

interface Options<S extends z.ZodType> {
  schema: S
  // Llama a la server function (login o register). Recibe los datos ya validados.
  submit: (data: z.output<S>, form: FormData) => Promise<unknown>
}

// "Controlador" de los formularios de acceso: valida, envía, y maneja errores y
// el estado de carga. Las páginas se quedan solo con el HTML.
export function useAuthForm<S extends z.ZodType>({
  schema,
  submit,
}: Options<S>) {
  const router = useRouter()
  const navigate = useNavigate()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const form = new FormData(event.currentTarget)
    // El esquema descarta los campos que no declara (ej. rol u org).
    const parsed = schema.safeParse(Object.fromEntries(form))
    if (!parsed.success) {
      setFieldErrors(translateFields(fieldErrorsFrom(parsed.error)))
      return
    }
    setFieldErrors({})

    setPending(true)
    try {
      await submit(parsed.data, form)
      await router.invalidate()
      await navigate({ to: '/' })
    } catch (error) {
      const apiError = await parseApiError(error)
      setFieldErrors(translateFields(apiError.fields))
      // Si el error ya se muestra en un campo, no se repite arriba.
      setFormError(apiError.fields ? '' : apiErrorMessage(apiError))
    } finally {
      setPending(false)
    }
  }

  return { fieldErrors, formError, pending, handleSubmit }
}
