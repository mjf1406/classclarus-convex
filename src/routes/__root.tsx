import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import '../styles.css'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { ConvexReactClient } from 'convex/react'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '#/components/theme/theme-provider'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { ErrorPage } from '@/components/errors/ErrorPage'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: ErrorPage,
})

function RootComponent() {
  return (
    <>
      <ConvexAuthProvider client={convex}>
        <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
          <RequireAuth>
            <Outlet />
          </RequireAuth>
        </ThemeProvider>
        <Toaster />
      </ConvexAuthProvider>
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'TanStack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </>
  )
}
