import { useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

type ClassAdminBundle = FunctionReturnType<
  typeof api.memberships.getClassAdminBundle
>
type ClassRoster = FunctionReturnType<typeof api.students.listClassRoster>

function removeGuardianFromStudents<
  T extends {
    orgStudentId: Id<'orgStudents'>
    guardians: Array<{ guardianUserId: Id<'users'> }>
  },
>(
  students: Array<T>,
  orgStudentId: Id<'orgStudents'>,
  guardianUserId: Id<'users'>,
): Array<T> {
  return students.map((student) => {
    if (student.orgStudentId !== orgStudentId) return student
    return {
      ...student,
      guardians: student.guardians.filter(
        (guardian) => guardian.guardianUserId !== guardianUserId,
      ),
    }
  })
}

export function useUnlinkGuardian() {
  return useMutation(api.guardians.unlinkGuardian).withOptimisticUpdate(
    (localStore, args) => {
      if (!args.classId) return

      const queryArgs = { classId: args.classId }
      const bundle = localStore.getQuery(
        api.memberships.getClassAdminBundle,
        queryArgs,
      )
      if (bundle) {
        localStore.setQuery(api.memberships.getClassAdminBundle, queryArgs, {
          ...bundle,
          guardianRoster: {
            ...bundle.guardianRoster,
            students: removeGuardianFromStudents(
              bundle.guardianRoster.students,
              args.orgStudentId,
              args.guardianUserId,
            ),
          },
        } satisfies ClassAdminBundle)
      }

      const roster = localStore.getQuery(
        api.students.listClassRoster,
        queryArgs,
      )
      if (roster) {
        localStore.setQuery(api.students.listClassRoster, queryArgs, {
          ...roster,
          students: removeGuardianFromStudents(
            roster.students,
            args.orgStudentId,
            args.guardianUserId,
          ),
        } satisfies ClassRoster)
      }
    },
  )
}
