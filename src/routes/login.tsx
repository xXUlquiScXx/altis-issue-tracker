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
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthForm } from '@/hooks/use-auth-form'
import { useRememberedEmail } from '@/hooks/use-remembered-email'
import { forgetEmail, rememberEmail } from '@/lib/remembered-email'
import { loginSchema } from '@/lib/schemas'
import { login } from '@/server/auth/functions'

export const Route = createFileRoute('/login')({
  // ?redirect=/issues/123: página a la que volver después de entrar.
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: LoginPage,
})

function LoginPage() {
  const rememberedEmail = useRememberedEmail()
  const { redirect } = Route.useSearch()
  const { fieldErrors, formError, pending, handleSubmit } = useAuthForm({
    schema: loginSchema,
    redirectTo: redirect,
    submit: async (data, form) => {
      await login({ data })
      // Solo se guarda el correo cuando el login salió bien y el checkbox está marcado.
      if (form.get('remember') === 'on') rememberEmail(data.email)
      else forgetEmail()
    },
  })

  return (
    <main className="grid min-h-svh place-items-center p-4">
      {/* Flotante: estas pantallas no tienen barra superior. */}
      <ThemeToggle className="fixed top-3 right-3" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>Entra con tu correo y contraseña</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              {/* La key remonta el input cuando se carga el correo guardado. */}
              <Input
                key={rememberedEmail}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={rememberedEmail}
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
                autoComplete="current-password"
                aria-invalid={!!fieldErrors.password}
              />
              {fieldErrors.password && (
                <p className="text-sm text-destructive">
                  {fieldErrors.password}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 space-y-2">
              <Checkbox
                key={rememberedEmail}
                id="remember"
                name="remember"
                defaultChecked={rememberedEmail !== ''}
              />
              <Label htmlFor="remember" className="font-normal">
                Recordar mi correo
              </Label>
            </div>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-3 pt-6">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Entrando...' : 'Entrar'}
            </Button>
            <p className="text-sm text-muted-foreground">
              ¿No tienes cuenta?{' '}
              <Link to="/register" search={{ redirect }} className="underline">
                Regístrate
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
