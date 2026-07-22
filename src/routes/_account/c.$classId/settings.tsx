import { Navigate, createFileRoute } from '@tanstack/react-router'

import { useClassLayout } from '#/components/classes/ClassLayoutContext'
import { ClassSettingsSection } from '#/components/classes/ClassSettingsSection'

export const Route = createFileRoute('/_account/c/$classId/settings')({
  component: ClassSettingsPage,
})

function ClassSettingsPage() {
  const { classId, canManage } = useClassLayout()

  if (!canManage) {
    return <Navigate to="/c/$classId/points" params={{ classId }} replace />
  }

  return <ClassSettingsSection />
}
