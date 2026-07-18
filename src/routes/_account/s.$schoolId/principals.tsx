import { createFileRoute } from '@tanstack/react-router'

import { SchoolStaffMembersSection } from '#/components/schools/SchoolStaffMembersSection'

export const Route = createFileRoute('/_account/s/$schoolId/principals')({
  component: SchoolPrincipalsPage,
})

function SchoolPrincipalsPage() {
  const { schoolId } = Route.useParams()
  return (
    <SchoolStaffMembersSection schoolId={schoolId} roleFilter="principals" />
  )
}
