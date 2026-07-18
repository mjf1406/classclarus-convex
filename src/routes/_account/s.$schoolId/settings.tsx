import { createFileRoute } from '@tanstack/react-router'

import { SchoolSettingsSection } from '#/components/schools/SchoolSettingsSection'

export const Route = createFileRoute('/_account/s/$schoolId/settings')({
  component: SchoolSettingsPage,
})

function SchoolSettingsPage() {
  return <SchoolSettingsSection />
}
