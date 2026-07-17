import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useConvexAuth } from '@convex-dev/auth/react'
import {
  useNavigate,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import PendingComponent from '@/components/loading/PendingComponent'

const PUBLIC_PATHS = new Set(['/login', '/unauthorized'])

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const router = useRouter()
  const wasAuthLoading = useRef(true)

  const isPublicPath = PUBLIC_PATHS.has(pathname)

  // Re-run route loaders once auth is ready so Convex queries in loaders succeed.
  useEffect(() => {
    if (wasAuthLoading.current && !isLoading && isAuthenticated) {
      wasAuthLoading.current = false
      void router.invalidate()
    }
    if (!isLoading) {
      wasAuthLoading.current = false
    }
  }, [isLoading, isAuthenticated, router])

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
