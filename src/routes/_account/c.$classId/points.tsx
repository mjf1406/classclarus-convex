import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/_account/c/$classId/points')({
  component: ClassPointsPage,
})

function ClassPointsPage() {
  const { t } = useTranslation('classes')

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">{t('navPoints')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('pointsPlaceholder')}
      </p>
    </div>
  )
}
