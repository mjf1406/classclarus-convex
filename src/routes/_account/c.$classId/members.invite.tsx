import { Navigate, createFileRoute } from '@tanstack/react-router'

import { useClassLayout } from '#/components/classes/ClassLayoutContext'
import { JoinCodesSection } from '#/components/classes/JoinCodesSection'

export const Route = createFileRoute('/_account/c/$classId/members/invite')({
  component: ClassInvitePage,
})

function ClassInvitePage() {
  const { classId, canManageMembers, classDoc } = useClassLayout()

  if (!canManageMembers) {
    return <Navigate to="/c/$classId/points" params={{ classId }} replace />
  }

  return (
    <JoinCodesSection
      classId={classId}
      isOrgClass={classDoc?.organizationId !== undefined}
    />
  )
}
