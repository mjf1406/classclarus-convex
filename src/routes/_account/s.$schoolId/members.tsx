import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_account/s/$schoolId/members')({
  component: SchoolMembersLayout,
})

function SchoolMembersLayout() {
  return <Outlet />
}
