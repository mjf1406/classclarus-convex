import { Navigate, createFileRoute } from '@tanstack/react-router'

import { useClassLayout } from '#/components/classes/ClassLayoutContext'
import { JoinCodesSection } from '#/components/classes/JoinCodesSection'

export const Route = createFileRoute('/_account/c/$classId/invite')({
  component: ClassInvitePage,
})

function ClassInvitePage() {
  const { classId, canManage, canManageMembers, adminBundle } =
    useClassLayout()

  if (!canManageMembers) {
    return (
      <Navigate to="/c/$classId/points" params={{ classId }} replace />
    )
  }

  return (
    <JoinCodesSection
      classId={classId}
      codes={adminBundle?.joinCodes}
      canRegenerate={canManage}
    />
  )
}
