import { useMutation } from 'convex/react'

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

export function useAssignClassToTeam(_schoolId: string) {
  return useMutation(api.schools.assignClassToTeam).withOptimisticUpdate(
    (localStore, args) => {
      for (const { args: queryArgs, value } of localStore.getAllQueries(
        api.schools.listSchoolClasses,
      )) {
        if (!value || !queryArgs) continue
        const next = value.map((cls) =>
          cls._id === args.classId
            ? {
                ...cls,
                teamId: args.teamId === null ? undefined : args.teamId,
              }
            : cls,
        )
        localStore.setQuery(api.schools.listSchoolClasses, queryArgs, next)
      }
    },
  )
}

export function useAssignClassStaff(_classId: Id<'classes'> | null) {
  return useMutation(api.schools.assignClassStaff).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.schools.listClassStaff, {
        classId: args.classId,
      })
      if (!current) return
      if (current.some((s) => s.userId === args.userId && s.role === args.role)) {
        return
      }
      const without = current.filter((s) => s.userId !== args.userId)
      localStore.setQuery(api.schools.listClassStaff, { classId: args.classId }, [
        ...without,
        {
          userId: args.userId,
          role: args.role,
        },
      ])
    },
  )
}

export function useRemoveClassStaff(_classId: Id<'classes'> | null) {
  return useMutation(api.schools.removeClassStaff).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.schools.listClassStaff, {
        classId: args.classId,
      })
      if (!current) return
      localStore.setQuery(
        api.schools.listClassStaff,
        { classId: args.classId },
        current.filter(
          (s) => !(s.userId === args.userId && s.role === args.role),
        ),
      )
    },
  )
}

export function useEnrollStudent(_classId: Id<'classes'> | null) {
  return useMutation(api.students.enrollStudent)
}

export function useUnenrollStudent(_classId: Id<'classes'> | null) {
  return useMutation(api.students.unenrollStudent).withOptimisticUpdate(
    (localStore, args) => {
      const roster = localStore.getQuery(api.students.listClassRoster, {
        classId: args.classId,
      })
      if (!roster) return
      localStore.setQuery(api.students.listClassRoster, { classId: args.classId }, {
        ...roster,
        students: roster.students.filter(
          (s) => s.orgStudentId !== args.orgStudentId,
        ),
      })
    },
  )
}

export function useCreateOrgStudent(_schoolId: string) {
  return useMutation(api.students.createOrgStudent)
}
