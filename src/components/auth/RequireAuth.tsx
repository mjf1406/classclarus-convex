import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react'
import {
  useNavigate,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import PendingComponent from '@/components/loading/PendingComponent'
import { getSafeAuthRedirect } from '@/lib/authRedirect'
import { ONE_HOUR } from '@/lib/queryCache'
import { api } from '../../../convex/_generated/api'

const PUBLIC_PATHS = new Set(['/login', '/unauthorized', '/join-share'])

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { signOut } = useAuthActions()
  const { data: currentUser, isFetched: currentUserFetched } = useQuery({
    ...convexQuery(api.users.current, isAuthenticated ? {} : 'skip'),
    gcTime: ONE_HOUR,
  })
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
  const clearingZombieSession = useRef(false)

  const isPublicPath = PUBLIC_PATHS.has(pathname)
  const isZombieSession =
    isAuthenticated && currentUserFetched && currentUser === null
  const shouldRedirectToLogin =
    (!isAuthenticated || isZombieSession) && !isPublicPath
  const postLoginTarget =
    pathname === '/login' ? getSafeAuthRedirect(redirectParam) : '/'

  // Client token present but server identity missing (bad JWT / wiped users).
  useEffect(() => {
    if (!isZombieSession || clearingZombieSession.current) return
    clearingZombieSession.current = true
    void signOut().finally(() => {
      clearingZombieSession.current = false
    })
  }, [isZombieSession, signOut])

  // Re-run route loaders once auth is ready so Convex queries in loaders succeed.
  useEffect(() => {
    if (
      wasAuthLoading.current &&
      !isLoading &&
      isAuthenticated &&
      !isZombieSession
    ) {
      wasAuthLoading.current = false
      void router.invalidate()
    }
    if (!isLoading) {
      wasAuthLoading.current = false
    }
  }, [isLoading, isAuthenticated, isZombieSession, router])

  useEffect(() => {
    if (isLoading) return
    if (isAuthenticated && !currentUserFetched && !isPublicPath) return

    if (shouldRedirectToLogin) {
      const returnTo = `${pathname}${searchStr}`
      void navigate({
        to: '/login',
        search: { redirect: returnTo },
        replace: true,
      })
      return
    }

    if (isAuthenticated && !isZombieSession && pathname === '/login') {
      router.history.replace(postLoginTarget)
    }
  }, [
    isLoading,
    isAuthenticated,
    isZombieSession,
    currentUserFetched,
    isPublicPath,
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

  // Wait for users.current before rendering protected pages (avoids zombie UI).
  if (isAuthenticated && !currentUserFetched && !isPublicPath) {
    return <PendingComponent />
  }

  if (shouldRedirectToLogin) {
    return <PendingComponent />
  }

  if (isAuthenticated && !isZombieSession && pathname === '/login') {
    return <PendingComponent />
  }

  return children
}
