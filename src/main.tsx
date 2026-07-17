import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import PendingComponent from './components/loading/PendingComponent'
import { ErrorPage } from './components/errors/ErrorPage'
import { queryClient } from '#/lib/convex'

const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: 'viewport',
  scrollRestoration: true,
  defaultPreloadGcTime: 1000 * 60, // 1 minute,
  defaultPendingComponent: PendingComponent,
  defaultPendingMs: 50,
  defaultPendingMinMs: 300,
  defaultErrorComponent: ErrorPage,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(<RouterProvider router={router} />)
}
