import { createFileRoute } from '@tanstack/react-router'

import { SchoolStaffMembersSection } from '#/components/schools/SchoolStaffMembersSection'

export const Route = createFileRoute('/_account/s/$schoolId/teachers')({
  component: SchoolTeachersPage,
})

function SchoolTeachersPage() {
  const { schoolId } = Route.useParams()
  return <SchoolStaffMembersSection schoolId={schoolId} roleFilter="teachers" />
}
