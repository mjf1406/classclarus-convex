import { Navigate, createFileRoute } from '@tanstack/react-router'

import { useClassLayout } from '#/components/classes/ClassLayoutContext'
import { ClassGuardiansSection } from '#/components/classes/ClassGuardiansSection'

export const Route = createFileRoute('/_account/c/$classId/guardians')({
  component: ClassGuardiansPage,
})

function ClassGuardiansPage() {
  const { classId, canManageMembers } = useClassLayout()

  if (!canManageMembers) {
    return <Navigate to="/c/$classId/points" params={{ classId }} replace />
  }

  return <ClassGuardiansSection classId={classId} />
}
