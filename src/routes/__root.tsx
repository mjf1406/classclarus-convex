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
import { PwaUpdatePrompt } from '@/components/pwa/PwaUpdatePrompt'
import { ThemeProvider } from '#/components/theme/theme-provider'
import { LocaleProvider } from '#/i18n/LocaleProvider'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { ErrorPage } from '@/components/errors/ErrorPage'
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
          <LocaleProvider>
            <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
              <RequireAuth>
                <div vaul-drawer-wrapper="" className="bg-background">
                  <TooltipProvider>
                    <HeadContent />
                    <Outlet />
                  </TooltipProvider>
                </div>
              </RequireAuth>
            </ThemeProvider>
            <Toaster />
            <PwaUpdatePrompt />
          </LocaleProvider>
        </QueryClientProvider>
      </ConvexAuthProvider>
      {import.meta.env.DEV ? (
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
      ) : null}
    </>
  )
}
