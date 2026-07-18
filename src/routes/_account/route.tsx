import { Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'

import { AccountNavbar } from '#/components/layout/AccountNavbar'

export const Route = createFileRoute('/_account')({
  component: AccountLayout,
})

function AccountLayout() {
  const isShellRoute = useRouterState({
    select: (state) => {
      const path = state.location.pathname
      return path.startsWith('/c/') || path.startsWith('/s/')
    },
  })

  return (
    <div className="min-h-svh bg-background">
      {isShellRoute ? null : <AccountNavbar />}
      <Outlet />
    </div>
  )
}
