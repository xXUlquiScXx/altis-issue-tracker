import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseApiError } from '@/lib/api-error'
import { fieldErrorsFrom } from '@/lib/forms'
import { apiErrorMessage, translateFields } from '@/lib/messages'
import { registerSchema } from '@/lib/schemas'
import { register } from '@/server/auth/functions'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const router = useRouter()
  const navigate = Route.useNavigate()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const form = new FormData(event.currentTarget)
    // Solo se envían nombre, correo y contraseña: rol y org los decide el servidor.
    const parsed = registerSchema.safeParse({
      name: form.get('name'),
      email: form.get('email'),
      password: form.get('password'),
    })
    if (!parsed.success) {
      setFieldErrors(translateFields(fieldErrorsFrom(parsed.error)))
      return
    }
    setFieldErrors({})

    setPending(true)
    try {
      await register({ data: parsed.data })
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

  return (
    <main className="grid min-h-svh place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Crear cuenta</CardTitle>
          <CardDescription>
            Te registrarás como miembro de la organización demo
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit} noValidate>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                aria-invalid={!!fieldErrors.name}
              />
              {fieldErrors.name && (
                <p className="text-sm text-destructive">{fieldErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!fieldErrors.email}
              />
              {fieldErrors.email && (
                <p className="text-sm text-destructive">{fieldErrors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!fieldErrors.password}
              />
              {fieldErrors.password && (
                <p className="text-sm text-destructive">
                  {fieldErrors.password}
                </p>
              )}
            </div>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-3 pt-6">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
            <p className="text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="underline">
                Inicia sesión
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
