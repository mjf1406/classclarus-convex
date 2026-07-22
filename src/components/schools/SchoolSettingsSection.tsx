import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import { SchoolFormCredenza } from '#/components/schools/SchoolFormCredenza'
import { useSchoolLayout } from '#/components/schools/SchoolLayoutContext'
import {
  useArchiveSchool,
  useAssignClassesToSchool,
  useUnarchiveSchool,
  isSchoolArchived,
} from '#/lib/schools'
import { ONE_HOUR } from '#/lib/queryCache'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'

export function SchoolSettingsSection() {
  const { t } = useTranslation(['schools', 'common'])
  const { schoolId, school, canManage } = useSchoolLayout()
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState<Array<Id<'classes'>>>([])
  const archiveSchool = useArchiveSchool()
  const unarchiveSchool = useUnarchiveSchool()
  const assignClasses = useAssignClassesToSchool()

  const { data: accountHome } = useQuery({
    ...convexQuery(api.memberships.getAccountHome, {}),
    gcTime: ONE_HOUR,
  })

  const soloClasses = useMemo(() => {
    if (!accountHome?.classes) return undefined
    return accountHome.classes.filter(
      (classDoc) =>
        classDoc.organizationId === undefined &&
        classDoc.canManage === true &&
        classDoc.archivedTime === undefined,
    )
  }, [accountHome?.classes])

  if (!school) return null

  const archived = isSchoolArchived(school)

  const toggleClass = (classId: Id<'classes'>) => {
    setSelected((current) =>
      current.includes(classId)
        ? current.filter((id) => id !== classId)
        : [...current, classId],
    )
  }

  const handleArchiveToggle = () => {
    const run = archived ? unarchiveSchool : archiveSchool
    void run({ schoolId })
      .then(() => {
        toast.success(archived ? t('schoolUnarchived') : t('schoolArchived'))
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : archived
              ? t('unarchiveFailed')
              : t('archiveFailed'),
        )
      })
  }

  const handleAssign = () => {
    if (selected.length === 0) return
    void assignClasses({ schoolId, classIds: selected })
      .then(() => {
        toast.success(t('bringClassesSuccess'))
        setSelected([])
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : t('bringClassesFailed'),
        )
      })
  }

  return (
    <section className="space-y-10">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {t('settingsTitle')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('settingsDescription')}
        </p>
        {canManage ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(true)}
            >
              {t('edit')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleArchiveToggle}
            >
              {archived ? t('unarchive') : t('archive')}
            </Button>
          </div>
        ) : null}
      </div>

      <div>
        <h3 className="text-lg font-semibold tracking-tight">
          {t('bringClassesTitle')}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('bringClassesDescription')}
        </p>
        {soloClasses === undefined ? (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : soloClasses.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {t('noSoloClasses')}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <ul className="divide-y rounded-lg border">
              {soloClasses.map((classDoc) => (
                <li
                  key={classDoc._id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <Checkbox
                    checked={selected.includes(classDoc._id)}
                    onCheckedChange={() => toggleClass(classDoc._id)}
                    aria-label={classDoc.name}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{classDoc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {classDoc.year}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              disabled={selected.length === 0}
              onClick={handleAssign}
            >
              {t('bringClassesSubmit')}
            </Button>
          </div>
        )}
      </div>

      <SchoolFormCredenza
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        school={school}
      />
    </section>
  )
}
