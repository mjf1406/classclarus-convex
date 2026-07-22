import { Navigate, createFileRoute } from '@tanstack/react-router'

import { useClassLayout } from '#/components/classes/ClassLayoutContext'
import { ClassStudentsSection } from '#/components/classes/ClassStudentsSection'

export const Route = createFileRoute('/_account/c/$classId/students')({
  component: ClassStudentsPage,
})

function ClassStudentsPage() {
  const { classId, canManageMembers, adminBundle } = useClassLayout()

  if (!canManageMembers) {
    return <Navigate to="/c/$classId/points" params={{ classId }} replace />
  }

  return (
    <ClassStudentsSection
      classId={classId}
      pdfData={adminBundle?.guardianRoster}
    />
  )
}
