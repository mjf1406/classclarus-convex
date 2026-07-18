import { requireUser } from '#/lib/auth'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { v } from 'convex/values'
import {
  assignClassCreator,
  classScope,
  highestClassRole,
  hasClassPermission,
  requireClassPermission,
} from './lib/classAuth'
import type { ClassRole } from './lib/classAuth'
import { authz } from './authz'
import { generateUniqueJoinCode } from './lib/joinCodes'
import { hasGuardianAccessToClass } from './lib/guardianAuth'
import {
  DEFAULT_APP_LANGUAGE,
  DEFAULT_CLASS_LANGUAGE,
  coerceClassLanguage,
  classLanguageValidator,
} from './lib/languages'
import type { ClassLanguage } from './lib/languages'
import { tenantsClient } from './tenants'

// Public class shape: join codes and the display pin are redacted. Codes are
// only available via getJoinCodes — student code gated on class:manageMembers;
// teacher/assistant codes only when the caller also has class:manage.
// Otherwise a student who can read the class could read teacherCode and escalate.
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
  language: classLanguageValidator,
})

export const classRoleValidator = v.union(
  v.literal('creator'),
  v.literal('classTeacher'),
  v.literal('assistantTeacher'),
  v.literal('student'),
)

/** Display role on class cards/pages — includes guardian (ReBAC, not a roster role). */
export const classDisplayRoleValidator = v.union(
  classRoleValidator,
  v.literal('guardian'),
)

// Class shape enriched with the caller's own (highest) roster role — what the
// class cards and the class page render as a badge. Optional because access
// can come from non-roster grants (e.g. Phase 2 org staff). Includes
// `guardian` when access is via a linked child enrollment.
// Permission flags are set by getClass and listMyClasses so the UI can gate
// manage actions without separate checkClassPermission subscriptions.
export const classSchoolRefValidator = v.object({
  id: v.string(),
  name: v.string(),
})

export const classDocWithMyRole = v.object({
  ...classDocPublic.fields,
  myRole: v.optional(classDisplayRoleValidator),
  canManage: v.optional(v.boolean()),
  canManageMembers: v.optional(v.boolean()),
  school: v.optional(classSchoolRefValidator),
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
  language: ClassLanguage
}

export type ClassDisplayRole = ClassRole | 'guardian'
export type ClassSchoolRef = {
  id: string
  name: string
}

export type ClassWithMyRole = ClassPublic & {
  myRole?: ClassDisplayRole
  canManage?: boolean
  canManageMembers?: boolean
  school?: ClassSchoolRef
}

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
    language: coerceClassLanguage(doc.language),
  }
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
    if (canRead) {
      const entries = await authz.getUserRoles(
        ctx,
        user._id,
        classScope(args.classId),
      )
      const heldRoles = entries.map((entry) => entry.role)
      const myRole = highestClassRole(heldRoles) ?? undefined

      // `class:manage` and `class:manageMembers` are granted only by
      // `creator` and `classTeacher` class roles in `convex/authz.ts`.
      const canManage =
        heldRoles.includes('creator') || heldRoles.includes('classTeacher')
      const canManageMembers = canManage
      let school: ClassSchoolRef | undefined
      if (doc.organizationId !== undefined) {
        const org = await tenantsClient.getOrganization(ctx, doc.organizationId)
        if (org) {
          school = { id: org._id, name: org.name }
        }
      }
      return {
        ...toPublicClass(doc),
        myRole,
        canManage,
        canManageMembers,
        school,
      }
    }

    const isGuardian = await hasGuardianAccessToClass(
      ctx,
      user._id,
      args.classId,
    )
    if (!isGuardian) return null
    let school: ClassSchoolRef | undefined
    if (doc.organizationId !== undefined) {
      const org = await tenantsClient.getOrganization(ctx, doc.organizationId)
      if (org) {
        school = { id: org._id, name: org.name }
      }
    }
    return {
      ...toPublicClass(doc),
      myRole: 'guardian' as const,
      canManage: false,
      canManageMembers: false,
      school,
    }
  },
})

export const createClass = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    year: v.number(),
    publicDisplayPin: v.optional(v.string()),
    language: v.optional(classLanguageValidator),
    organizationId: v.optional(v.string()),
    teamId: v.optional(v.string()),
  },
  returns: v.id('classes'),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const studentCode = await generateUniqueJoinCode(ctx)
    const teacherCode = await generateUniqueJoinCode(ctx, [studentCode])
    const assistantTeacherCode = await generateUniqueJoinCode(ctx, [
      studentCode,
      teacherCode,
    ])

    const language = args.language ?? DEFAULT_CLASS_LANGUAGE

    let organizationId: string | undefined
    let teamId: string | undefined

    if (args.organizationId !== undefined) {
      const member = await tenantsClient.getMember(
        ctx,
        args.organizationId,
        user._id,
      )
      if (!member || member.status === 'suspended') {
        throw new Error('Not a member of this school')
      }
      const org = await tenantsClient.getOrganization(ctx, args.organizationId)
      if (!org || org.status === 'archived' || org.status === 'suspended') {
        throw new Error('School is not active')
      }
      organizationId = args.organizationId

      if (args.teamId !== undefined) {
        const team = await tenantsClient.getTeam(ctx, args.teamId)
        if (!team || team.organizationId !== args.organizationId) {
          throw new Error('Team does not belong to this school')
        }
        teamId = args.teamId
      }
    } else if (args.teamId !== undefined) {
      throw new Error('teamId requires organizationId')
    }

    const classId = await ctx.db.insert('classes', {
      // userId is denormalized creator metadata; authorization uses authz.
      userId: user._id,
      name: args.name,
      description: args.description,
      icon: args.icon,
      year: args.year,
      publicDisplayPin: args.publicDisplayPin,
      studentCode,
      teacherCode,
      assistantTeacherCode,
      organizationId,
      teamId,
      language,
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
    language: v.optional(classLanguageValidator),
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
      language?: ClassLanguage
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
    if (args.language !== undefined) updates.language = args.language
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

    const enrollment = await ctx.db
      .query('classEnrollments')
      .withIndex('by_classId', (index) => index.eq('classId', args.classId))
      .first()
    if (enrollment) {
      throw new Error('This class has enrollment history; archive it instead')
    }

    // Residual: authz role assignments scoped to this class id remain in the
    // component (no scope-wide revoke API). They are inert; listMyClasses
    // drops ids whose db.get returns null.
    await ctx.db.delete(args.classId)
    return null
  },
})

export const getJoinCodes = internalQuery({
  args: {
    classId: v.id('classes'),
  },
  returns: v.object({
    studentCode: v.string(),
    /** Only present when caller has class:manage. */
    teacherCode: v.union(v.string(), v.null()),
    assistantTeacherCode: v.union(v.string(), v.null()),
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

    const canManage = await hasClassPermission(
      ctx,
      user._id,
      args.classId,
      'class:manage',
    )

    return {
      studentCode: doc.studentCode,
      teacherCode: canManage ? doc.teacherCode : null,
      assistantTeacherCode: canManage ? doc.assistantTeacherCode : null,
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

// One-shot: set language on classes that predate the field.
//   npx convex run classes:backfillLanguage
export const backfillLanguage = internalMutation({
  args: {},
  returns: v.object({ scanned: v.number(), updated: v.number() }),
  handler: async (ctx) => {
    const classes = await ctx.db.query('classes').collect()
    let updated = 0
    for (const doc of classes) {
      if (doc.language !== undefined) continue
      await ctx.db.patch(doc._id, { language: DEFAULT_APP_LANGUAGE })
      updated++
    }
    return { scanned: classes.length, updated }
  },
})
