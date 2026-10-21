import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import { ROLE_LABEL } from '@/lib/labels'
import type { SessionUser } from '@/lib/types'
import { logout } from '@/server/auth/functions'

const navLinkClass =
  'rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground'

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')
}

// Barra superior: marca, navegación, cambio de tema y menú del usuario.
export function AppHeader({ user }: { user: SessionUser }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const logoutMutation = useMutation({
    mutationFn: () => api(() => logout()),
    onSuccess: async () => {
      // La caché tiene datos de esta sesión: se borra antes de volver al login.
      queryClient.clear()
      await router.invalidate()
    },
  })

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-4">
        <span className="font-semibold">Issue Tracker</span>

        <nav aria-label="Principal" className="flex items-center">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className={navLinkClass}
            activeProps={{ className: 'bg-muted font-medium text-foreground' }}
          >
            Lista
          </Link>
          <Link
            to="/kanban"
            className={navLinkClass}
            activeProps={{ className: 'bg-muted font-medium text-foreground' }}
          >
            Kanban
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="gap-2 px-1.5"
                aria-label="Menú de usuario"
              >
                <span className="grid size-6 place-items-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  {initials(user.name)}
                </span>
                <span className="hidden max-w-32 truncate sm:inline">
                  {user.name}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="space-y-1 font-normal">
                <p className="font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">
                    {user.orgName}
                  </span>
                  <Badge variant="secondary">{ROLE_LABEL[user.role]}</Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={logoutMutation.isPending}
                onSelect={() => logoutMutation.mutate()}
              >
                <LogOut />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
