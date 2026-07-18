import { Navigate, createFileRoute } from '@tanstack/react-router'

import { useClassLayout } from '#/components/classes/ClassLayoutContext'

export const Route = createFileRoute('/_account/c/$classId/members')({
  component: ClassMembersRedirect,
})

function ClassMembersRedirect() {
  const { classId } = useClassLayout()
  return (
    <Navigate to="/c/$classId/students" params={{ classId }} replace />
  )
}
