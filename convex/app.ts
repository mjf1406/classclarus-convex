// convex/app.ts — query refs for the AuthzProvider React integration.
// The provider passes { userId, permission, scope? }; we keep that shape but
// never trust the client-supplied userId: checks are only performed for the
// authenticated caller.
import { getCurrentUser } from '#/lib/auth'
import { query } from './_generated/server'
import { v } from 'convex/values'
import { authz } from './authz'

export const checkPermission = query({
  args: {
    userId: v.string(),
    permission: v.string(),
    scope: v.optional(v.object({ type: v.string(), id: v.string() })),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return false
    // Ignore spoofed userIds — only answer for the caller.
    if (args.userId !== user._id) return false
    return await authz.can(
      ctx,
      user._id,
      args.permission as Parameters<typeof authz.can>[2],
      args.scope,
    )
  },
})

export const getUserRoles = query({
  args: {
    userId: v.string(),
    scope: v.optional(v.object({ type: v.string(), id: v.string() })),
  },
  returns: v.array(
    v.object({
      role: v.string(),
      scopeKey: v.string(),
      scope: v.optional(v.object({ type: v.string(), id: v.string() })),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []
    if (args.userId !== user._id) return []
    return await authz.getUserRoles(ctx, user._id, args.scope)
  },
})
