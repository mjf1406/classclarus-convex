import { useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'

import { api } from '../../convex/_generated/api'

type ClassRoster = FunctionReturnType<typeof api.students.listClassRoster>
type RosterStudent = ClassRoster['students'][number]

function formatDisplayName(student: {
  firstName: string
  lastName: string
  rosterFirstName?: string
  rosterLastName?: string
}): string {
  const first =
    student.rosterFirstName?.trim() || student.firstName.trim() || ''
  const last = student.rosterLastName?.trim() || student.lastName.trim() || ''
  const formatted = [first, last].filter(Boolean).join(' ')
  return formatted || 'Student'
}

function patchRosterStudent(
  roster: ClassRoster,
  match: (student: RosterStudent) => boolean,
  patch: (student: RosterStudent) => RosterStudent,
): ClassRoster {
  return {
    ...roster,
    students: roster.students.map((student) =>
      match(student) ? patch(student) : student,
    ),
  }
}

export function useUpdateStudentProfile() {
  return useMutation(api.students.updateStudentProfile).withOptimisticUpdate(
    (localStore, args) => {
      const queryArgs = { classId: args.classId }
      const roster = localStore.getQuery(api.students.listClassRoster, queryArgs)
      if (!roster) return

      localStore.setQuery(
        api.students.listClassRoster,
        queryArgs,
        patchRosterStudent(
          roster,
          (student) => student.orgStudentId === args.orgStudentId,
          (student) => ({
            ...student,
            ...(args.gender !== undefined ? { gender: args.gender } : {}),
            ...(args.pronouns !== undefined ? { pronouns: args.pronouns } : {}),
          }),
        ),
      )
    },
  )
}

export function useUpdateEnrollmentDisplay() {
  return useMutation(api.students.updateEnrollmentDisplay).withOptimisticUpdate(
    (localStore, args) => {
      const queryArgs = { classId: args.classId }
      const roster = localStore.getQuery(api.students.listClassRoster, queryArgs)
      if (!roster) return

      localStore.setQuery(
        api.students.listClassRoster,
        queryArgs,
        patchRosterStudent(
          roster,
          (student) => student.enrollmentId === args.enrollmentId,
          (student) => {
            const rosterFirstName =
              args.rosterFirstName !== undefined
                ? args.rosterFirstName.trim() || undefined
                : student.rosterFirstName
            const rosterLastName =
              args.rosterLastName !== undefined
                ? args.rosterLastName.trim() || undefined
                : student.rosterLastName
            const next = {
              ...student,
              rosterFirstName,
              rosterLastName,
            }
            return {
              ...next,
              displayName: formatDisplayName(next),
            }
          },
        ),
      )
    },
  )
}
