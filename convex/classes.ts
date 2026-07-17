import { requireUser } from '#/lib/auth'
import { internalMutation, mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { v } from 'convex/values'
import {
  assignClassCreator,
  classScope,
  getMyClassRole,
  hasClassPermission,
  requireClassPermission,
} from './lib/classAuth'
import type { ClassRole } from './lib/classAuth'
import { authz } from './authz'

// Public class shape: join codes and the display pin are redacted. Codes are
// only available via getJoinCodes (gated on class:manageMembers) — otherwise a
// student who can read the class could read teacherCode and escalate.
export const classDocPublic = v.object({
  _id: v.id('classes'),
  _creationTime: v.number(),
  userId: v.id('users'),
  name: v.string(),
  description: v.optional(v.string()),
  icon: v.optional(v.string()),
  year: v.number(),
  updatedTime: v.optional(v.number()),
  archivedTime: v.optional(v.number()),
  organizationId: v.optional(v.string()),
  teamId: v.optional(v.string()),
})

export const classRoleValidator = v.union(
  v.literal('creator'),
  v.literal('classTeacher'),
  v.literal('assistantTeacher'),
  v.literal('student'),
)

// Class shape enriched with the caller's own (highest) roster role — what the
// class cards and the class page render as a badge. Optional because access
// can come from non-roster grants (e.g. Phase 2 org staff).
export const classDocWithMyRole = v.object({
  ...classDocPublic.fields,
  myRole: v.optional(classRoleValidator),
})

export const classSort = v.union(
  v.literal('createdDesc'),
  v.literal('createdAsc'),
  v.literal('updatedDesc'),
  v.literal('updatedAsc'),
  v.literal('nameAsc'),
  v.literal('nameDesc'),
)

export type ClassPublic = {
  _id: Doc<'classes'>['_id']
  _creationTime: number
  userId: Doc<'classes'>['userId']
  name: string
  description?: string
  icon?: string
  year: number
  updatedTime?: number
  archivedTime?: number
  organizationId?: string
  teamId?: string
}

export type ClassWithMyRole = ClassPublic & { myRole?: ClassRole }

export function toPublicClass(doc: Doc<'classes'>): ClassPublic {
  return {
    _id: doc._id,
    _creationTime: doc._creationTime,
    userId: doc.userId,
    name: doc.name,
    description: doc.description,
    icon: doc.icon,
    year: doc.year,
    updatedTime: doc.updatedTime,
    archivedTime: doc.archivedTime,
    organizationId: doc.organizationId,
    teamId: doc.teamId,
  }
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const JOIN_CODE_LENGTH = 8

function generateJoinCode(length = JOIN_CODE_LENGTH): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let code = ''
  for (let i = 0; i < length; i++) {
    // bytes[i] is defined for i < length; non-null assertion keeps strict indexing happy.
    code += CODE_CHARS[bytes[i]! % CODE_CHARS.length]
  }
  return code
}

async function isCodeTaken(ctx: MutationCtx, code: string): Promise<boolean> {
  const [byStudent, byTeacher, byAssistant] = await Promise.all([
    ctx.db
      .query('classes')
      .withIndex('by_studentCode', (q) => q.eq('studentCode', code))
      .first(),
    ctx.db
      .query('classes')
      .withIndex('by_teacherCode', (q) => q.eq('teacherCode', code))
      .first(),
    ctx.db
      .query('classes')
      .withIndex('by_assistantTeacherCode', (q) =>
        q.eq('assistantTeacherCode', code),
      )
      .first(),
  ])
  return byStudent !== null || byTeacher !== null || byAssistant !== null
}

// Redemption lookups use "exactly one match" semantics, so codes must be
// unique across all three code fields of all classes.
async function generateUniqueJoinCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateJoinCode()
    if (!(await isCodeTaken(ctx, code))) {
      return code
    }
  }
  throw new Error('Failed to generate a unique join code')
}

export const getClass = query({
  args: {
    classId: v.id('classes'),
  },
  returns: v.union(classDocWithMyRole, v.null()),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const doc = await ctx.db.get(args.classId)
    if (!doc) return null
    // "No access" is indistinguishable from "not found" — avoids leaking
    // class existence.
    const canRead = await hasClassPermission(
      ctx,
      user._id,
      args.classId,
      'class:read',
    )
    if (!canRead) return null
    const myRole = await getMyClassRole(ctx, user._id, args.classId)
    return { ...toPublicClass(doc), myRole: myRole ?? undefined }
  },
})

export const createClass = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    year: v.number(),
    publicDisplayPin: v.optional(v.string()),
  },
  returns: v.id('classes'),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    const classId = await ctx.db.insert('classes', {
      // userId is denormalized creator metadata; authorization uses authz.
      userId: user._id,
      name: args.name,
      description: args.description,
      icon: args.icon,
      year: args.year,
      publicDisplayPin: args.publicDisplayPin,
      studentCode: await generateUniqueJoinCode(ctx),
      teacherCode: await generateUniqueJoinCode(ctx),
      assistantTeacherCode: await generateUniqueJoinCode(ctx),
      organizationId: undefined,
      teamId: undefined,
    })

    // Same mutation as the insert, so both commit atomically.
    await assignClassCreator(ctx, user._id, classId)

    return classId
  },
})

export const updateClass = mutation({
  args: {
    classId: v.id('classes'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    publicDisplayPin: v.optional(v.string()),
    archived: v.optional(v.boolean()),
    // Note: year is intentionally not accepted — it is immutable after creation.
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireClassPermission(ctx, user._id, args.classId, 'class:manage')

    const existing = await ctx.db.get(args.classId)
    if (!existing) {
      throw new Error('Class not found')
    }

    const updates: {
      name?: string
      description?: string
      icon?: string
      publicDisplayPin?: string
      archivedTime?: number | undefined
      updatedTime: number
    } = {
      updatedTime: Date.now(),
    }

    if (args.name !== undefined) updates.name = args.name
    if (args.description !== undefined) updates.description = args.description
    if (args.icon !== undefined) updates.icon = args.icon
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
    await requireClassPermission(ctx, user._id, args.classId, 'class:manage')

    const existing = await ctx.db.get(args.classId)
    if (!existing) {
      throw new Error('Class not found')
    }

    // Phase 2: refuse deletion when classEnrollments rows reference this class
    // ("archive instead"). Solo classes have no dependent rows yet.
    //
    // Residual: authz role assignments scoped to this class id remain in the
    // component (no scope-wide revoke API). They are inert; listMyClasses
    // drops ids whose db.get returns null.
    await ctx.db.delete(args.classId)
    return null
  },
})

export const getJoinCodes = query({
  args: {
    classId: v.id('classes'),
  },
  returns: v.object({
    studentCode: v.string(),
    teacherCode: v.string(),
    assistantTeacherCode: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireClassPermission(
      ctx,
      user._id,
      args.classId,
      'class:manageMembers',
    )

    const doc = await ctx.db.get(args.classId)
    if (!doc) {
      throw new Error('Class not found')
    }

    return {
      studentCode: doc.studentCode,
      teacherCode: doc.teacherCode,
      assistantTeacherCode: doc.assistantTeacherCode,
    }
  },
})

export const regenerateJoinCode = mutation({
  args: {
    classId: v.id('classes'),
    codeType: v.union(
      v.literal('student'),
      v.literal('teacher'),
      v.literal('assistantTeacher'),
    ),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireClassPermission(ctx, user._id, args.classId, 'class:manage')

    const existing = await ctx.db.get(args.classId)
    if (!existing) {
      throw new Error('Class not found')
    }

    const newCode = await generateUniqueJoinCode(ctx)
    const field =
      args.codeType === 'student'
        ? 'studentCode'
        : args.codeType === 'teacher'
          ? 'teacherCode'
          : 'assistantTeacherCode'

    // Regenerating does not revoke roles already redeemed with the old code.
    await ctx.db.patch(args.classId, {
      [field]: newCode,
      updatedTime: Date.now(),
    })

    return newCode
  },
})

// One-shot migration: grant the `creator` class role to each class's original
// owner (classes.userId). Run once when switching authorization from userId
// ownership to authz roles:
//   npx convex run classes:backfillCreatorRoles
export const backfillCreatorRoles = internalMutation({
  args: {},
  returns: v.object({ scanned: v.number(), assigned: v.number() }),
  handler: async (ctx) => {
    const classes = await ctx.db.query('classes').collect()
    let assigned = 0
    for (const doc of classes) {
      const alreadyCreator = await authz.hasRole(
        ctx,
        doc.userId,
        'creator',
        classScope(doc._id),
      )
      if (!alreadyCreator) {
        await assignClassCreator(ctx, doc.userId, doc._id)
        assigned++
      }
    }
    return { scanned: classes.length, assigned }
  },
})
