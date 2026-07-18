import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_account/c/$classId/members')({
  component: ClassMembersLayout,
})

function ClassMembersLayout() {
  return <Outlet />
}
