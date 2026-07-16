// convex/app.ts (or similar)
import { query } from './_generated/server'
import { v } from 'convex/values'
import { authz } from './authz'

export const checkPermission = query({
  args: {
    userId: v.string(),
    permission: v.string(),
    scope: v.optional(v.object({ type: v.string(), id: v.string() })),
  },
  handler: async (ctx, args) => {
    return authz.can(
      ctx,
      args.userId,
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
  handler: async (ctx, args) => {
    return authz.getUserRoles(ctx, args.userId, args.scope)
  },
})
