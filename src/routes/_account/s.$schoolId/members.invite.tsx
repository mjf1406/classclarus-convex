import { createFileRoute } from '@tanstack/react-router'

import { SchoolInviteSection } from '#/components/schools/SchoolInviteSection'

export const Route = createFileRoute('/_account/s/$schoolId/members/invite')({
  component: SchoolInvitePage,
})

function SchoolInvitePage() {
  const { schoolId } = Route.useParams()
  return <SchoolInviteSection schoolId={schoolId} />
}
