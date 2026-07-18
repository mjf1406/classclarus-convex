import { Navigate, createFileRoute } from '@tanstack/react-router'

import { useClassLayout } from '#/components/classes/ClassLayoutContext'
import { ClassStaffMembersSection } from '#/components/classes/ClassStaffMembersSection'

export const Route = createFileRoute('/_account/c/$classId/assistant-teachers')({
  component: ClassAssistantTeachersPage,
})

function ClassAssistantTeachersPage() {
  const { classId, canManageMembers } = useClassLayout()

  if (!canManageMembers) {
    return (
      <Navigate to="/c/$classId/points" params={{ classId }} replace />
    )
  }

  return (
    <ClassStaffMembersSection
      classId={classId}
      roleFilter="assistantTeachers"
    />
  )
}
