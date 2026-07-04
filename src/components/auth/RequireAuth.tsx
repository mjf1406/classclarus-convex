import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useConvexAuth } from '@convex-dev/auth/react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import PendingComponent from '@/components/loading/PendingComponent'

const PUBLIC_PATHS = new Set(['/login', '/unauthorized'])

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()

  const isPublicPath = PUBLIC_PATHS.has(pathname)

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated && !isPublicPath) {
      void navigate({ to: '/login', replace: true })
      return
    }

    if (isAuthenticated && pathname === '/login') {
      void navigate({ to: '/', replace: true })
    }
  }, [isLoading, isAuthenticated, isPublicPath, pathname, navigate])

  if (isLoading) {
    return <PendingComponent />
  }

  if (!isAuthenticated && !isPublicPath) {
    return <PendingComponent />
  }

  if (isAuthenticated && pathname === '/login') {
    return <PendingComponent />
  }

  return children
}
