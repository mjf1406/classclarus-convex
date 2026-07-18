import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getCurrentUser, requireUser } from '#/lib/auth'
import {
  coerceAppLanguage,
  DEFAULT_APP_LANGUAGE,
  languageValidator,
} from './lib/languages'

export const homeSectionIdValidator = v.union(
  v.literal('classes'),
  v.literal('schools'),
)

export const DEFAULT_HOME_SECTION_ORDER = ['classes', 'schools'] as const

const preferencesValidator = v.object({
  language: languageValidator,
  homeSectionOrder: v.array(homeSectionIdValidator),
})

function normalizeHomeSectionOrder(
  order: Array<'classes' | 'schools'> | undefined,
): Array<'classes' | 'schools'> {
  if (!order || order.length === 0) {
    return [...DEFAULT_HOME_SECTION_ORDER]
  }
  const seen = new Set<'classes' | 'schools'>()
  const normalized: Array<'classes' | 'schools'> = []
  for (const id of order) {
    if (seen.has(id)) continue
    seen.add(id)
    normalized.push(id)
  }
  for (const id of DEFAULT_HOME_SECTION_ORDER) {
    if (!seen.has(id)) normalized.push(id)
  }
  return normalized
}

export const getMyPreferences = query({
  args: {},
  returns: v.union(preferencesValidator, v.null()),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null

    const prefs = await ctx.db
      .query('userPreferences')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()
    if (!prefs) return null
    return {
      language: coerceAppLanguage(prefs.language),
      homeSectionOrder: normalizeHomeSectionOrder(prefs.homeSectionOrder),
    }
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

export const setHomeSectionOrder = mutation({
  args: {
    homeSectionOrder: v.array(homeSectionIdValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const order = normalizeHomeSectionOrder(args.homeSectionOrder)
    const existing = await ctx.db
      .query('userPreferences')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, { homeSectionOrder: order })
    } else {
      await ctx.db.insert('userPreferences', {
        userId: user._id,
        language: DEFAULT_APP_LANGUAGE,
        homeSectionOrder: order,
      })
    }
    return null
  },
})
