import { getCurrentUser } from '#/lib/auth'
import { query } from './_generated/server'
import { v } from 'convex/values'
import { authz } from './authz'
import { classScope } from './lib/classAuth'

// Closed union of the class permissions the UI legitimately checks (guide §14
// item 5). The server-side check makes probing harmless, but a closed set
// keeps the surface auditable.
const classPermissionValidator = v.union(
  v.literal('class:read'),
  v.literal('class:manage'),
  v.literal('class:manageMembers'),
  v.literal('class:grade'),
  v.literal('class:submit'),
  v.literal('class:viewOwnGrades'),
  v.literal('class:viewChildGrades'),
)

export const checkClassPermission = query({
  args: {
    classId: v.id('classes'),
    permission: classPermissionValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    // Never throw — this feeds UI gating.
    const user = await getCurrentUser(ctx)
    if (!user) return false
    return await authz.can(
      ctx,
      user._id,
      args.permission,
      classScope(args.classId),
    )
  },
})
