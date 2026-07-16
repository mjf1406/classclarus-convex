import { requireUser } from '#/lib/auth'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { v } from 'convex/values'

const classDoc = v.object({
  _id: v.id('classes'),
  _creationTime: v.number(),
  userId: v.id('users'),
  name: v.string(),
  description: v.optional(v.string()),
  icon: v.optional(v.string()),
  year: v.optional(v.number()),
  updatedTime: v.optional(v.number()),
  archivedTime: v.optional(v.number()),
  studentCode: v.string(),
  teacherCode: v.string(),
  assistantTeacherCode: v.string(),
  publicDisplayPin: v.optional(v.string()),
})

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateJoinCode(length = 6): string {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

async function getOwnedClass(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  classId: Id<'classes'>,
): Promise<Doc<'classes'> | null> {
  const doc = await ctx.db.get(classId)
  if (!doc) return null
  if (doc.userId !== userId) {
    throw new Error('Unauthorized')
  }
  return doc
}

export const listClasses = query({
  args: {
    includeArchived: v.optional(v.boolean()),
    archivedOnly: v.optional(v.boolean()),
  },
  returns: v.array(classDoc),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const archivedOnly = args.archivedOnly ?? false
    const includeArchived = args.includeArchived ?? false

    const classes = await ctx.db
      .query('classes')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(100)

    if (archivedOnly) {
      return classes.filter((c) => c.archivedTime !== undefined)
    }

    if (includeArchived) {
      return classes
    }

    return classes.filter((c) => c.archivedTime === undefined)
  },
})

export const getClass = query({
  args: {
    classId: v.id('classes'),
  },
  returns: v.union(classDoc, v.null()),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    return await getOwnedClass(ctx, user._id, args.classId)
  },
})

export const createClass = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    year: v.optional(v.number()),
    publicDisplayPin: v.optional(v.string()),
  },
  returns: v.id('classes'),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    return await ctx.db.insert('classes', {
      userId: user._id,
      name: args.name,
      description: args.description,
      icon: args.icon,
      year: args.year,
      publicDisplayPin: args.publicDisplayPin,
      studentCode: generateJoinCode(),
      teacherCode: generateJoinCode(),
      assistantTeacherCode: generateJoinCode(),
    })
  },
})

export const updateClass = mutation({
  args: {
    classId: v.id('classes'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    year: v.optional(v.number()),
    publicDisplayPin: v.optional(v.string()),
    archived: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const existing = await getOwnedClass(ctx, user._id, args.classId)
    if (!existing) {
      throw new Error('Class not found')
    }

    const updates: {
      name?: string
      description?: string
      icon?: string
      year?: number
      publicDisplayPin?: string
      archivedTime?: number | undefined
      updatedTime: number
    } = {
      updatedTime: Date.now(),
    }

    if (args.name !== undefined) updates.name = args.name
    if (args.description !== undefined) updates.description = args.description
    if (args.icon !== undefined) updates.icon = args.icon
    if (args.year !== undefined) updates.year = args.year
    if (args.publicDisplayPin !== undefined) {
      updates.publicDisplayPin = args.publicDisplayPin
    }
    if (args.archived === true) {
      updates.archivedTime = Date.now()
    } else if (args.archived === false) {
      updates.archivedTime = undefined
    }

    await ctx.db.patch(args.classId, updates)

    return null
  },
})

export const removeClass = mutation({
  args: {
    classId: v.id('classes'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const existing = await getOwnedClass(ctx, user._id, args.classId)
    if (!existing) {
      throw new Error('Class not found')
    }

    await ctx.db.delete(args.classId)
    return null
  },
})
