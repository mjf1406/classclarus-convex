import { createFileRoute } from '@tanstack/react-router'

import { SchoolTeamsBoard } from '#/components/schools/SchoolTeamsBoard'

export const Route = createFileRoute('/_account/s/$schoolId/teams')({
  component: SchoolTeamsPage,
})

function SchoolTeamsPage() {
  const { schoolId } = Route.useParams()
  return <SchoolTeamsBoard schoolId={schoolId} />
}
