import { Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'

import { AccountNavbar } from '#/components/layout/AccountNavbar'

export const Route = createFileRoute('/_account')({
  component: AccountLayout,
})

function AccountLayout() {
  const isClassRoute = useRouterState({
    select: (state) => state.location.pathname.startsWith('/c/'),
  })

  return (
    <div className="min-h-svh bg-background">
      {isClassRoute ? null : <AccountNavbar />}
      <Outlet />
    </div>
  )
}
