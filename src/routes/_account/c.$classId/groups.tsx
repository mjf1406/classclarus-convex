import { Navigate, createFileRoute } from '@tanstack/react-router'

import { useClassLayout } from '#/components/classes/ClassLayoutContext'
import { ClassGroupsBoard } from '#/components/groups/ClassGroupsBoard'

export const Route = createFileRoute('/_account/c/$classId/groups')({
  component: ClassGroupsPage,
})

function ClassGroupsPage() {
  const { classId, canManageMembers } = useClassLayout()

  if (!canManageMembers) {
    return (
      <Navigate to="/c/$classId/points" params={{ classId }} replace />
    )
  }

  return <ClassGroupsBoard classId={classId} />
}
