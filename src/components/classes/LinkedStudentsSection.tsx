import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { ClassRoleBadge } from '#/components/classes/ClassRoleBadge'
import type { Id } from '../../../convex/_generated/dataModel'

type LinkedChildClass = {
  classId: Id<'classes'>
  name: string
  year: number
  archivedTime?: number
}

type LinkedChild = {
  orgStudentId: Id<'orgStudents'>
  displayName: string
  classes: Array<LinkedChildClass>
}

export function LinkedStudentsSection({
  linkedChildren,
}: {
  linkedChildren?: Array<LinkedChild>
}) {
  const { t } = useTranslation('home')

  if (linkedChildren === undefined || linkedChildren.length === 0) {
    return null
  }

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold tracking-tight">
        {t('myChildren')}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('childrenClasses')}
      </p>
      <ul className="mt-4 space-y-4">
        {linkedChildren.map((child) => (
          <li
            key={child.orgStudentId}
            className="rounded-xl border border-border p-4"
          >
            <p className="text-sm font-medium">{child.displayName}</p>
            {child.classes.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t('noActiveClassesYet')}
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
                {child.classes.map((classDoc) => (
                  <li key={classDoc.classId}>
                    <Link
                      to="/c/$classId"
                      params={{ classId: classDoc.classId }}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted/50"
                      preload={false}
                    >
                      <span className="min-w-0 truncate font-medium">
                        ({classDoc.year}) {classDoc.name}
                      </span>
                      <ClassRoleBadge role="guardian" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
