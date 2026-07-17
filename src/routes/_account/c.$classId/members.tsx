import { Navigate, createFileRoute } from '@tanstack/react-router'

import { useClassLayout } from '#/components/classes/ClassLayoutContext'
import { ClassMembersSection } from '#/components/classes/ClassMembersSection'

export const Route = createFileRoute('/_account/c/$classId/members')({
  component: ClassMembersPage,
})

function ClassMembersPage() {
  const { classId, canManage, adminBundle } = useClassLayout()

  if (!canManage) {
    return (
      <Navigate to="/c/$classId/points" params={{ classId }} replace />
    )
  }

  return (
    <ClassMembersSection classId={classId} members={adminBundle?.members} />
  )
}
