import { useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { ClassRole } from '#/lib/classes'

export type ClassMember = {
  userId: Id<'users'>
  name?: string
  email?: string
  role: ClassRole
}

type ClassAdminBundle = FunctionReturnType<
  typeof api.memberships.getClassAdminBundle
>

export function useRemoveMember() {
  return useMutation(api.memberships.removeMember).withOptimisticUpdate(
    (localStore, args) => {
      const queryArgs = { classId: args.classId }
      const bundle = localStore.getQuery(
        api.memberships.getClassAdminBundle,
        queryArgs,
      )
      if (!bundle) return

      localStore.setQuery(api.memberships.getClassAdminBundle, queryArgs, {
        ...bundle,
        members: bundle.members.filter(
          (member) => member.userId !== args.userId,
        ),
      } satisfies ClassAdminBundle)
    },
  )
}
