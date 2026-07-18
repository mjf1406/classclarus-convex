import { v } from 'convex/values'
import { query } from './_generated/server'

export const getAuthProviders = query({
  args: {},
  returns: v.object({
    password: v.boolean(),
    google: v.boolean(),
  }),
  handler: async () => {
    const google =
      Boolean(process.env.AUTH_GOOGLE_ID) &&
      Boolean(process.env.AUTH_GOOGLE_SECRET)
    const password = process.env.AUTH_PASSWORD_ENABLED === 'true'

    return { password, google }
  },
})
