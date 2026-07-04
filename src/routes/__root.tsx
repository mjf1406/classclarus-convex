import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import '../styles.css'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { ConvexReactClient } from 'convex/react'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '#/components/theme/theme-provider'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { ErrorPage } from '@/components/errors/ErrorPage'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

const convexQueryClient = new ConvexQueryClient(convex)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn(),
    },
  },
})
convexQueryClient.connect(queryClient)

export const Route = createRootRoute({
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
              <div vaul-drawer-wrapper="" className="bg-background">
                <Outlet />
              </div>
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
