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
import { useQuery } from 'convex/react'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '#/components/theme/theme-provider'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { ErrorPage } from '@/components/errors/ErrorPage'
import { AuthzProvider } from '@djpanda/convex-authz/react'
import type { ReactNode } from 'react'
import { api } from '../../convex/_generated/api'
import { convex, queryClient } from '#/lib/convex'
import type { RouterContext } from '#/lib/convex'
import { TooltipProvider } from '#/components/ui/tooltip'

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  errorComponent: ErrorPage,
})

// Server-side checks ignore spoofed ids; this just tells the authz hooks who
// the caller is.
function AppAuthzProvider({ children }: { children: ReactNode }) {
  const user = useQuery(api.users.current)
  return (
    <AuthzProvider
      queryRefs={{
        checkPermission: api.app.checkPermission,
        getUserRoles: api.app.getUserRoles,
      }}
      defaultUserId={user?._id}
    >
      {children}
    </AuthzProvider>
  )
}

function RootComponent() {
  return (
    <>
      <ConvexAuthProvider client={convex}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
            <RequireAuth>
              <AppAuthzProvider>
                <div vaul-drawer-wrapper="" className="bg-background">
                  <TooltipProvider>
                    <HeadContent />
                    <Outlet />
                  </TooltipProvider>
                </div>
              </AppAuthzProvider>
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
