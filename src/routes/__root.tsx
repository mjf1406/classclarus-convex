import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { QueryClientProvider } from '@tanstack/react-query'
import '../styles.css'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '#/components/theme/theme-provider'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { ErrorPage } from '@/components/errors/ErrorPage'
import { AuthzProvider } from '@djpanda/convex-authz/react'
import { api } from '../../convex/_generated/api'
import { convex, queryClient } from '#/lib/convex'
import type { RouterContext } from '#/lib/convex'
import { TooltipProvider } from '#/components/ui/tooltip'

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  errorComponent: ErrorPage,
})

function RootComponent() {
  return (
    <>
      <ConvexAuthProvider client={convex}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
            <RequireAuth>
              <AuthzProvider
                queryRefs={{
                  checkPermission: api.app.checkPermission,
                  getUserRoles: api.app.getUserRoles,
                }}
              >
                <div vaul-drawer-wrapper="" className="bg-background">
                  <TooltipProvider>
                    <HeadContent />
                    <Outlet />
                  </TooltipProvider>
                </div>
              </AuthzProvider>
            </RequireAuth>
          </ThemeProvider>
          <Toaster />
        </QueryClientProvider>
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
