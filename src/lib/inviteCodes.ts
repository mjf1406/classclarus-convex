import { useMutation } from 'convex/react'
import {
  useMutation as useTanstackMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { ONE_HOUR } from './queryCache'

export const INVITE_TTL_HOURS = [1, 6, 12, 24, 48, 72] as const
export type InviteTtlHours = (typeof INVITE_TTL_HOURS)[number]

export const INVITE_MAX_USES_PRESETS = [1, 5, 10, 25, 50] as const
export const MAX_INVITE_USES = 100

export type InvitePublic = {
  _id: Id<'inviteCodes'>
  code: string
  scope: 'class' | 'school'
  role: string
  createdAt: number
  expiresAt: number
  maxUses: number | null
  useCount: number
  remainingUses: number | null
}

export type ClassInviteRole =
  | 'student'
  | 'classTeacher'
  | 'assistantTeacher'

export type SchoolInviteRole =
  | 'principal'
  | 'vicePrincipal'
  | 'assistantVicePrincipal'
  | 'teacher'
  | 'admin'

function classInvitesQuery(classId: Id<'classes'>, now: number) {
  return {
    ...convexQuery(api.inviteCodes.listClassInvites, { classId, now }),
    gcTime: ONE_HOUR,
  }
}

function schoolInvitesQuery(schoolId: string, now: number) {
  return {
    ...convexQuery(api.inviteCodes.listSchoolInvites, { schoolId, now }),
    gcTime: ONE_HOUR,
  }
}

export function classInvitesQueryOptions(classId: Id<'classes'>, now: number) {
  return classInvitesQuery(classId, now)
}

export function schoolInvitesQueryOptions(schoolId: string, now: number) {
  return schoolInvitesQuery(schoolId, now)
}

export function useCreateClassInvite(classId: Id<'classes'>, now: number) {
  const create = useMutation(api.inviteCodes.createClassInvite)
  const queryClient = useQueryClient()
  const query = classInvitesQuery(classId, now)

  return useTanstackMutation({
    mutationFn: (args: {
      role: ClassInviteRole
      ttlHours: InviteTtlHours
      maxUses?: number
    }) => create({ classId, ...args }),
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: query.queryKey })
      const previous = queryClient.getQueryData(query.queryKey)
      const pendingId = `PENDING-${Date.now()}` as Id<'inviteCodes'>
      const pending: InvitePublic = {
        _id: pendingId,
        code: '········',
        scope: 'class',
        role: args.role,
        createdAt: Date.now(),
        expiresAt: Date.now() + args.ttlHours * 60 * 60 * 1000,
        maxUses: args.maxUses ?? null,
        useCount: 0,
        remainingUses: args.maxUses ?? null,
      }
      queryClient.setQueryData(
        query.queryKey,
        (old: InvitePublic[] | undefined) => [pending, ...(old ?? [])],
      )
      return { previous, pendingId }
    },
    onError: (_err, _args, context) => {
      if (context?.previous) {
        queryClient.setQueryData(query.queryKey, context.previous)
      }
    },
    onSuccess: (invite, _args, context) => {
      queryClient.setQueryData(
        query.queryKey,
        (old: InvitePublic[] | undefined) => {
          if (!old || !context.pendingId) return old
          return old.map((row) =>
            row._id === context.pendingId ? invite : row,
          )
        },
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: query.queryKey })
    },
  })
}

export function useCreateSchoolInvite(schoolId: string, now: number) {
  const create = useMutation(api.inviteCodes.createSchoolInvite)
  const queryClient = useQueryClient()
  const query = schoolInvitesQuery(schoolId, now)

  return useTanstackMutation({
    mutationFn: (args: {
      role: SchoolInviteRole
      ttlHours: InviteTtlHours
      maxUses?: number
    }) => create({ schoolId, ...args }),
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: query.queryKey })
      const previous = queryClient.getQueryData(query.queryKey)
      const pendingId = `PENDING-${Date.now()}` as Id<'inviteCodes'>
      const pending: InvitePublic = {
        _id: pendingId,
        code: '········',
        scope: 'school',
        role: args.role,
        createdAt: Date.now(),
        expiresAt: Date.now() + args.ttlHours * 60 * 60 * 1000,
        maxUses: args.maxUses ?? null,
        useCount: 0,
        remainingUses: args.maxUses ?? null,
      }
      queryClient.setQueryData(
        query.queryKey,
        (old: InvitePublic[] | undefined) => [pending, ...(old ?? [])],
      )
      return { previous, pendingId }
    },
    onError: (_err, _args, context) => {
      if (context?.previous) {
        queryClient.setQueryData(query.queryKey, context.previous)
      }
    },
    onSuccess: (invite, _args, context) => {
      queryClient.setQueryData(
        query.queryKey,
        (old: InvitePublic[] | undefined) => {
          if (!old || !context.pendingId) return old
          return old.map((row) =>
            row._id === context.pendingId ? invite : row,
          )
        },
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: query.queryKey })
    },
  })
}

export function useRevokeInvite(
  scope: { classId: Id<'classes'> } | { schoolId: string },
  now: number,
) {
  const revoke = useMutation(api.inviteCodes.revokeInvite)
  const queryClient = useQueryClient()
  const query =
    'classId' in scope
      ? classInvitesQuery(scope.classId, now)
      : schoolInvitesQuery(scope.schoolId, now)

  return useTanstackMutation({
    mutationFn: (args: { inviteId: Id<'inviteCodes'> }) => revoke(args),
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: query.queryKey })
      const previous = queryClient.getQueryData(query.queryKey)
      queryClient.setQueryData(
        query.queryKey,
        (old: InvitePublic[] | undefined) =>
          old?.filter((invite) => invite._id !== args.inviteId),
      )
      return { previous }
    },
    onError: (_err, _args, context) => {
      if (context?.previous) {
        queryClient.setQueryData(query.queryKey, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: query.queryKey })
    },
  })
}
