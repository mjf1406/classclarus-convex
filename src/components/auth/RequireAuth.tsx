import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useConvexAuth } from '@convex-dev/auth/react'
import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import PendingComponent from '@/components/loading/PendingComponent'
import { getSafeAuthRedirect } from '@/lib/authRedirect'

const PUBLIC_PATHS = new Set(['/login', '/unauthorized', '/join-share'])

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { pathname, searchStr, redirectParam } = useRouterState({
    select: (s) => {
      const search = s.location.search as { redirect?: unknown }
      return {
        pathname: s.location.pathname,
        searchStr: s.location.searchStr,
        redirectParam:
          typeof search.redirect === 'string' ? search.redirect : undefined,
      }
    },
  })
  const navigate = useNavigate()
  const router = useRouter()
  const wasAuthLoading = useRef(true)

  const isPublicPath = PUBLIC_PATHS.has(pathname)
  const shouldRedirectToLogin = !isAuthenticated && !isPublicPath
  const postLoginTarget =
    pathname === '/login' ? getSafeAuthRedirect(redirectParam) : '/'

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

    if (shouldRedirectToLogin) {
      const returnTo = `${pathname}${searchStr}`
      void navigate({
        to: '/login',
        search: { redirect: returnTo },
        replace: true,
      })
      return
    }

    if (isAuthenticated && pathname === '/login') {
      router.history.replace(postLoginTarget)
    }
  }, [
    isLoading,
    isAuthenticated,
    shouldRedirectToLogin,
    pathname,
    searchStr,
    postLoginTarget,
    navigate,
    router,
  ])

  if (isLoading) {
    return <PendingComponent />
  }

  if (shouldRedirectToLogin) {
    return <PendingComponent />
  }

  if (isAuthenticated && pathname === '/login') {
    return <PendingComponent />
  }

  return children
}
