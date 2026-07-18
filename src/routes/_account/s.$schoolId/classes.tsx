import { createFileRoute } from '@tanstack/react-router'

import { SchoolClassesBoard } from '#/components/schools/SchoolClassesBoard'

export const Route = createFileRoute('/_account/s/$schoolId/classes')({
  component: SchoolClassesPage,
})

function SchoolClassesPage() {
  const { schoolId } = Route.useParams()
  return <SchoolClassesBoard schoolId={schoolId} />
}
