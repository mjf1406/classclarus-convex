import { getCurrentUser } from './lib/auth'
import { v } from 'convex/values'
import { query } from './_generated/server'

const currentUserPublic = v.object({
  _id: v.id('users'),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  image: v.optional(v.string()),
})

export const current = query({
  args: {},
  returns: v.union(currentUserPublic, v.null()),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      image: user.image,
    }
  },
})
