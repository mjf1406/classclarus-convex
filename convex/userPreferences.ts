import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireUser } from '#/lib/auth'
import {
  coerceAppLanguage,
  languageValidator,
} from './lib/languages'

export const getMyPreferences = query({
  args: {},
  returns: v.union(
    v.object({
      language: languageValidator,
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    const prefs = await ctx.db
      .query('userPreferences')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
    if (!prefs) return null
    return { language: coerceAppLanguage(prefs.language) }
  },
})

export const setMyLanguage = mutation({
  args: {
    language: languageValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const existing = await ctx.db
      .query('userPreferences')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, { language: args.language })
    } else {
      await ctx.db.insert('userPreferences', {
        userId: user._id,
        language: args.language,
      })
    }
    return null
  },
})
