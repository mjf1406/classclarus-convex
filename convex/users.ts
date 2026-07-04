import { getCurrentUser } from '#/lib/auth'
import { query } from './_generated/server'

export const current = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx)
  },
})
