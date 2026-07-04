import { Outlet, createFileRoute } from '@tanstack/react-router'

import { AccountNavbar } from '#/components/layout/AccountNavbar'

export const Route = createFileRoute('/_account')({
  component: AccountLayout,
})

function AccountLayout() {
  return (
    <div className="min-h-svh bg-background">
      <AccountNavbar />
      <Outlet />
    </div>
  )
}
