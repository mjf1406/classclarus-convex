import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useConvexAuth } from '@convex-dev/auth/react'

import { ClassRoleBadge } from '#/components/classes/ClassRoleBadge'
import { api } from '../../../convex/_generated/api'
import { TEN_MINUTES } from '@/lib/queryCache'

export function LinkedStudentsSection() {
  const { isAuthenticated } = useConvexAuth()
  const { data: children } = useQuery({
    ...convexQuery(
      api.guardians.listMyChildren,
      isAuthenticated ? {} : 'skip',
    ),
    gcTime: TEN_MINUTES,
  })

  if (children === undefined || children.length === 0) {
    return null
  }

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold tracking-tight">My children</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Classes for your children
      </p>
      <ul className="mt-4 space-y-4">
        {children.map((child) => (
          <li
            key={child.orgStudentId}
            className="rounded-xl border border-border p-4"
          >
            <p className="text-sm font-medium">{child.displayName}</p>
            {child.classes.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No active classes yet.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
                {child.classes.map((classDoc) => (
                  <li key={classDoc.classId}>
                    <Link
                      to="/c/$classId"
                      params={{ classId: classDoc.classId }}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted/50"
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
