import { Link, createFileRoute } from '@tanstack/react-router'
import { PasswordInput } from '@/components/password-input'
import { ThemeToggle } from '@/components/theme-toggle'
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
import { useAuthForm } from '@/hooks/use-auth-form'
import { registerSchema } from '@/lib/schemas'
import { register } from '@/server/auth/functions'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const { fieldErrors, formError, pending, handleSubmit } = useAuthForm({
    schema: registerSchema,
    submit: (data) => register({ data }),
  })

  return (
    <main className="grid min-h-svh place-items-center p-4">
      {/* Flotante: estas pantallas no tienen barra superior. */}
      <ThemeToggle className="fixed top-3 right-3" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Crear cuenta</CardTitle>
          <CardDescription>
            Te registrarás como miembro de la organización demo
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} noValidate>
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
              <PasswordInput
                id="password"
                name="password"
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
