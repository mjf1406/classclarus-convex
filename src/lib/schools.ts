import { useMutation } from 'convex/react'
import { useMutation as useTanstackMutation, useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { ONE_HOUR } from './queryCache'
import type { ClassSort } from './classSort'
import { compareClasses } from './classSort'

export type SchoolOrgRole =
  | 'owner'
  | 'admin'
  | 'principal'
  | 'teacher'
  | 'member'

export type SchoolPublic = {
  _id: string
  _creationTime: number
  name: string
  slug: string
  logo: string | null
  status: 'active' | 'suspended' | 'archived'
  myRole: SchoolOrgRole
  canManage: boolean
  canManageMembers: boolean
}

export type SchoolMember = {
  userId: string
  name?: string
  email?: string
  role: SchoolOrgRole
  status?: 'active' | 'suspended'
}

export type HomeSectionId = 'classes' | 'schools'

export const DEFAULT_HOME_SECTION_ORDER: HomeSectionId[] = [
  'classes',
  'schools',
]

export const SCHOOL_ORG_ROLES = [
  'owner',
  'admin',
  'principal',
  'teacher',
  'member',
] as const satisfies readonly SchoolOrgRole[]

const PENDING_ID_PREFIX = 'PENDING-'

export function isPendingSchool(school: SchoolPublic): boolean {
  return String(school._id).startsWith(PENDING_ID_PREFIX)
}

export function isSchoolArchived(school: SchoolPublic): boolean {
  return school.status === 'archived'
}

/** Reuse class sort comparator — school cards share the same sortable fields. */
export function sortSchools<T extends SchoolPublic>(
  schools: readonly T[],
  sort: ClassSort,
  language?: string,
): T[] {
  return [...schools].sort((left, right) =>
    compareClasses(left, right, sort, language),
  )
}

function accountHomeQueryOptions() {
  return {
    ...convexQuery(api.memberships.getAccountHome, {}),
    gcTime: ONE_HOUR,
  }
}

export function useCreateSchool() {
  const createSchool = useMutation(api.schools.createSchool)
  const queryClient = useQueryClient()

  return useTanstackMutation({
    mutationFn: (args: { name: string; slug?: string }) => createSchool(args),
    onMutate: async (args) => {
      await queryClient.cancelQueries({
        queryKey: accountHomeQueryOptions().queryKey,
      })
      const previous = queryClient.getQueryData(accountHomeQueryOptions().queryKey)
      const pendingId = `${PENDING_ID_PREFIX}${Date.now()}`
      const pending: SchoolPublic = {
        _id: pendingId,
        _creationTime: Date.now(),
        name: args.name,
        slug: args.slug ?? args.name.toLowerCase().replace(/\s+/g, '-'),
        logo: null,
        status: 'active',
        myRole: 'owner',
        canManage: true,
        canManageMembers: true,
      }
      queryClient.setQueryData(
        accountHomeQueryOptions().queryKey,
        (old: { schools?: SchoolPublic[] } | undefined) => {
          if (!old) return old
          return {
            ...old,
            schools: [pending, ...(old.schools ?? [])],
          }
        },
      )
      return { previous, pendingId }
    },
    onError: (_err, _args, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          accountHomeQueryOptions().queryKey,
          context.previous,
        )
      }
    },
    onSuccess: (schoolId, _args, context) => {
      queryClient.setQueryData(
        accountHomeQueryOptions().queryKey,
        (old: { schools?: SchoolPublic[] } | undefined) => {
          if (!old?.schools || !context?.pendingId) return old
          return {
            ...old,
            schools: old.schools.map((school) =>
              school._id === context.pendingId
                ? { ...school, _id: schoolId }
                : school,
            ),
          }
        },
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: accountHomeQueryOptions().queryKey,
      })
    },
  }).mutateAsync
}

export function useArchiveSchool() {
  const archiveSchool = useMutation(api.schools.archiveSchool)
  const queryClient = useQueryClient()

  return useTanstackMutation({
    mutationFn: (args: { schoolId: string }) => archiveSchool(args),
    onMutate: async (args) => {
      await queryClient.cancelQueries({
        queryKey: accountHomeQueryOptions().queryKey,
      })
      const previous = queryClient.getQueryData(accountHomeQueryOptions().queryKey)
      queryClient.setQueryData(
        accountHomeQueryOptions().queryKey,
        (old: { schools?: SchoolPublic[] } | undefined) => {
          if (!old?.schools) return old
          return {
            ...old,
            schools: old.schools.map((school) =>
              school._id === args.schoolId
                ? { ...school, status: 'archived' as const }
                : school,
            ),
          }
        },
      )
      return { previous }
    },
    onError: (_err, _args, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          accountHomeQueryOptions().queryKey,
          context.previous,
        )
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: accountHomeQueryOptions().queryKey,
      })
    },
  }).mutateAsync
}

export function useUnarchiveSchool() {
  const unarchiveSchool = useMutation(api.schools.unarchiveSchool)
  const queryClient = useQueryClient()

  return useTanstackMutation({
    mutationFn: (args: { schoolId: string }) => unarchiveSchool(args),
    onMutate: async (args) => {
      await queryClient.cancelQueries({
        queryKey: accountHomeQueryOptions().queryKey,
      })
      const previous = queryClient.getQueryData(accountHomeQueryOptions().queryKey)
      queryClient.setQueryData(
        accountHomeQueryOptions().queryKey,
        (old: { schools?: SchoolPublic[] } | undefined) => {
          if (!old?.schools) return old
          return {
            ...old,
            schools: old.schools.map((school) =>
              school._id === args.schoolId
                ? { ...school, status: 'active' as const }
                : school,
            ),
          }
        },
      )
      return { previous }
    },
    onError: (_err, _args, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          accountHomeQueryOptions().queryKey,
          context.previous,
        )
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: accountHomeQueryOptions().queryKey,
      })
    },
  }).mutateAsync
}

export function useUpdateSchool() {
  const updateSchool = useMutation(api.schools.updateSchool)
  const queryClient = useQueryClient()

  return useTanstackMutation({
    mutationFn: (args: {
      schoolId: string
      name?: string
      slug?: string
    }) => updateSchool(args),
    onMutate: async (args) => {
      await queryClient.cancelQueries({
        queryKey: accountHomeQueryOptions().queryKey,
      })
      const previous = queryClient.getQueryData(accountHomeQueryOptions().queryKey)
      queryClient.setQueryData(
        accountHomeQueryOptions().queryKey,
        (old: { schools?: SchoolPublic[] } | undefined) => {
          if (!old?.schools) return old
          return {
            ...old,
            schools: old.schools.map((school) =>
              school._id === args.schoolId
                ? {
                    ...school,
                    name: args.name ?? school.name,
                    slug: args.slug ?? school.slug,
                  }
                : school,
            ),
          }
        },
      )
      return { previous }
    },
    onError: (_err, _args, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          accountHomeQueryOptions().queryKey,
          context.previous,
        )
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: accountHomeQueryOptions().queryKey,
      })
    },
  }).mutateAsync
}

export function useDeleteSchool() {
  const deleteSchool = useMutation(api.schools.deleteSchool)
  const queryClient = useQueryClient()

  return useTanstackMutation({
    mutationFn: (args: { schoolId: string }) => deleteSchool(args),
    onMutate: async (args) => {
      await queryClient.cancelQueries({
        queryKey: accountHomeQueryOptions().queryKey,
      })
      const previous = queryClient.getQueryData(accountHomeQueryOptions().queryKey)
      queryClient.setQueryData(
        accountHomeQueryOptions().queryKey,
        (old: { schools?: SchoolPublic[] } | undefined) => {
          if (!old?.schools) return old
          return {
            ...old,
            schools: old.schools.filter((school) => school._id !== args.schoolId),
          }
        },
      )
      return { previous }
    },
    onError: (_err, _args, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          accountHomeQueryOptions().queryKey,
          context.previous,
        )
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: accountHomeQueryOptions().queryKey,
      })
    },
  }).mutateAsync
}

export function useSetHomeSectionOrder() {
  const setOrder = useMutation(api.userPreferences.setHomeSectionOrder)
  const queryClient = useQueryClient()
  const prefsQuery = {
    ...convexQuery(api.userPreferences.getMyPreferences, {}),
    gcTime: ONE_HOUR,
  }

  return useTanstackMutation({
    mutationFn: (args: { homeSectionOrder: HomeSectionId[] }) =>
      setOrder(args),
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: prefsQuery.queryKey })
      const previous = queryClient.getQueryData(prefsQuery.queryKey)
      queryClient.setQueryData(
        prefsQuery.queryKey,
        (old: { language: string; homeSectionOrder?: HomeSectionId[] } | null | undefined) => {
          if (old === undefined || old === null) {
            return {
              language: 'en',
              homeSectionOrder: args.homeSectionOrder,
            }
          }
          return {
            ...old,
            homeSectionOrder: args.homeSectionOrder,
          }
        },
      )
      return { previous }
    },
    onError: (_err, _args, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(prefsQuery.queryKey, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: prefsQuery.queryKey })
    },
  }).mutateAsync
}

export function useAssignClassesToSchool() {
  const assign = useMutation(api.schools.assignClassesToSchool)
  const queryClient = useQueryClient()

  return useTanstackMutation({
    mutationFn: (args: {
      schoolId: string
      classIds: Array<Id<'classes'>>
      teamId?: string
    }) => assign(args),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: accountHomeQueryOptions().queryKey,
      })
    },
  }).mutateAsync
}

export function useRemoveSchoolMember(schoolId: string) {
  const removeMember = useMutation(api.tenants.removeMember)
  const queryClient = useQueryClient()
  const membersQuery = {
    ...convexQuery(api.schools.listSchoolMembers, { schoolId }),
    gcTime: ONE_HOUR,
  }

  return useTanstackMutation({
    mutationFn: (args: { memberUserId: string }) =>
      removeMember({ organizationId: schoolId, memberUserId: args.memberUserId }),
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: membersQuery.queryKey })
      const previous = queryClient.getQueryData(membersQuery.queryKey)
      queryClient.setQueryData(
        membersQuery.queryKey,
        (old: SchoolMember[] | undefined) =>
          old?.filter((member) => member.userId !== args.memberUserId),
      )
      return { previous }
    },
    onError: (_err, _args, context) => {
      if (context?.previous) {
        queryClient.setQueryData(membersQuery.queryKey, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: membersQuery.queryKey })
    },
  }).mutateAsync
}
