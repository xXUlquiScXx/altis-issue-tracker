/// <reference types="vite/client" />
import { QueryClientProvider } from '@tanstack/react-query'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useRouter,
} from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { AppToaster } from '@/components/app-toaster'
import { createQueryClient } from '@/lib/query-client'
import { themeInitScript } from '@/lib/theme'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        // resizes-content: en Android, el teclado encoge la página en vez de taparla.
        content:
          'width=device-width, initial-scale=1, interactive-widget=resizes-content',
      },
      { title: 'Issue Tracker' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
    // Aplica el tema guardado antes de pintar, para evitar el destello.
    scripts: [{ children: themeInitScript }],
  }),
  component: RootComponent,
})

function RootComponent() {
  const router = useRouter()
  // Un cliente por pestaña (y por petición en el servidor): no se comparte caché.
  const [queryClient] = useState(() =>
    createQueryClient(() => {
      void router.navigate({
        to: '/login',
        search: { redirect: router.state.location.href },
      })
    }),
  )

  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <AppToaster />
      </QueryClientProvider>
    </RootDocument>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: el script del tema cambia la clase de <html>
    // antes de que React arranque, y eso es intencional.
    <html lang="es" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
