import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { internalQuery } from '../_generated/server'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'

export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<'users'> | null> {
  const userId = await getAuthUserId(ctx)
  if (!userId) return null

  const user = await ctx.db.get(userId)

  return user
}

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<'users'>> {
  const user = await getCurrentUser(ctx)
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<'users'>> {
  const user = await requireUser(ctx)
  return user._id
}

export const requireUserQuery = internalQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    await requireUser(ctx)
    return true
  },
})
