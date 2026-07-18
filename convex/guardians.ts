import { requireUser } from './lib/auth'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { internalQuery, mutation, query } from './_generated/server'
import { authz } from './authz'
import { hasClassPermission, requireClassPermission } from './lib/classAuth'
import {
  GUARDIAN_RELATION,
  guardianAuthz,
  guardianObject,
  guardianSubject,
} from './lib/guardianAuth'
import {
  listGuardianLinksForStudent,
  rotateGuardianCode,
  unlinkAllGuardiansForOrgStudent,
  unlinkGuardianLinkInternal,
  tryRedeemGuardianCode,
} from './lib/guardianLinks'
import { rateLimiter } from './rateLimiter'
import {
  formatClassStudentName,
  formatOrgStudentName,
} from './lib/studentNames'

const RATE_LIMITED_ERROR = 'Too many attempts. Please try again later.'
const MAX_GUARDIAN_LINKS = 100
const MAX_STUDENT_ENROLLMENTS = 200
const MAX_CLASS_STUDENTS = 500

const guardianClassValidator = v.object({
  classId: v.id('classes'),
  name: v.string(),
  year: v.number(),
  archivedTime: v.optional(v.number()),
})

const childValidator = v.object({
  orgStudentId: v.id('orgStudents'),
  organizationId: v.optional(v.string()),
  displayName: v.string(),
  classes: v.array(guardianClassValidator),
})

/** Name + optional email for unlink / roster UI. */
const listedGuardianValidator = v.object({
  guardianUserId: v.id('users'),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  linkedAt: v.number(),
})

function organizationScope(organizationId: string): {
  type: 'organization'
  id: string
} {
  return { type: 'organization', id: organizationId }
}

async function hasClassManagementForStudent(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  orgStudentId: Id<'orgStudents'>,
  organizationId: string | undefined,
  requestedClassId?: Id<'classes'>,
): Promise<boolean> {
  if (requestedClassId) {
    const enrollment = await ctx.db
      .query('classEnrollments')
      .withIndex('by_classId_and_orgStudentId', (index) =>
        index.eq('classId', requestedClassId).eq('orgStudentId', orgStudentId),
      )
      .unique()
    if (
      !enrollment ||
      enrollment.status !== 'active' ||
      enrollment.organizationId !== organizationId
    ) {
      return false
    }
    return await hasClassPermission(
      ctx,
      userId,
      requestedClassId,
      'class:manageMembers',
    )
  }

  const enrollments = ctx.db
    .query('classEnrollments')
    .withIndex('by_orgStudentId', (index) =>
      index.eq('orgStudentId', orgStudentId),
    )

  for await (const enrollment of enrollments) {
    if (
      enrollment.status === 'active' &&
      enrollment.organizationId === organizationId &&
      (await hasClassPermission(
        ctx,
        userId,
        enrollment.classId,
        'class:manageMembers',
      ))
    ) {
      return true
    }
  }
  return false
}

async function canManageGuardianLink(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  orgStudentId: Id<'orgStudents'>,
  organizationId: string | undefined,
  permission: 'guardians:link' | 'guardians:unlink',
  classId?: Id<'classes'>,
): Promise<boolean> {
  if (organizationId !== undefined) {
    const hasOrganizationPermission = await authz
      .withTenant(organizationId)
      .can(ctx, userId, permission, organizationScope(organizationId))
    if (hasOrganizationPermission) {
      return true
    }
  }
  return await hasClassManagementForStudent(
    ctx,
    userId,
    orgStudentId,
    organizationId,
    classId,
  )
}

export const redeemGuardianCode = mutation({
  args: {
    code: v.string(),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      orgStudentId: v.id('orgStudents'),
    }),
    v.object({
      ok: v.literal(false),
      error: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    const perUser = await rateLimiter.limit(ctx, 'joinCodePerUser', {
      key: user._id,
    })
    if (!perUser.ok) {
      return { ok: false as const, error: RATE_LIMITED_ERROR }
    }
    const global = await rateLimiter.limit(ctx, 'joinCodeGlobal')
    if (!global.ok) {
      return { ok: false as const, error: RATE_LIMITED_ERROR }
    }

    return await tryRedeemGuardianCode(ctx, user._id, args.code)
  },
})

export const regenerateGuardianCode = mutation({
  args: {
    orgStudentId: v.id('orgStudents'),
    classId: v.optional(v.id('classes')),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const orgStudent = await ctx.db.get('orgStudents', args.orgStudentId)
    if (!orgStudent) {
      throw new Error('Student not found')
    }

    const allowed = await canManageGuardianLink(
      ctx,
      user._id,
      orgStudent._id,
      orgStudent.organizationId,
      'guardians:link',
      args.classId,
    )
    if (!allowed) {
      throw new Error('Not authorized to regenerate this guardian code')
    }

    return await rotateGuardianCode(ctx, orgStudent._id)
  },
})

export const unlinkGuardian = mutation({
  args: {
    orgStudentId: v.id('orgStudents'),
    guardianUserId: v.id('users'),
    classId: v.optional(v.id('classes')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx)
    const orgStudent = await ctx.db.get('orgStudents', args.orgStudentId)
    if (!orgStudent) {
      throw new Error('Student not found')
    }

    if (caller._id !== args.guardianUserId) {
      const allowed = await canManageGuardianLink(
        ctx,
        caller._id,
        orgStudent._id,
        orgStudent.organizationId,
        'guardians:unlink',
        args.classId,
      )
      if (!allowed) {
        throw new Error('Not authorized to unlink this guardian')
      }
    }

    await unlinkGuardianLinkInternal(
      ctx,
      caller._id,
      orgStudent,
      args.guardianUserId,
    )

    return null
  },
})

export const unlinkAllGuardiansForStudent = mutation({
  args: {
    orgStudentId: v.id('orgStudents'),
    classId: v.id('classes'),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx)
    const [classDoc, orgStudent, enrollment] = await Promise.all([
      ctx.db.get('classes', args.classId),
      ctx.db.get('orgStudents', args.orgStudentId),
      ctx.db
        .query('classEnrollments')
        .withIndex('by_classId_and_orgStudentId', (index) =>
          index
            .eq('classId', args.classId)
            .eq('orgStudentId', args.orgStudentId),
        )
        .unique(),
    ])
    if (
      !classDoc ||
      !orgStudent ||
      classDoc.organizationId !== orgStudent.organizationId ||
      enrollment?.organizationId !== classDoc.organizationId ||
      enrollment?.status !== 'active'
    ) {
      throw new Error('Student is not actively enrolled in this class')
    }

    const allowed = await canManageGuardianLink(
      ctx,
      caller._id,
      orgStudent._id,
      orgStudent.organizationId,
      'guardians:unlink',
      args.classId,
    )
    if (!allowed) {
      throw new Error('Not authorized to unlink guardians for this student')
    }

    return await unlinkAllGuardiansForOrgStudent(ctx, caller._id, orgStudent)
  },
})

export const listMyChildren = query({
  args: {},
  returns: v.array(childValidator),
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    const links = await ctx.db
      .query('guardianLinks')
      .withIndex('by_guardianUserId', (index) =>
        index.eq('guardianUserId', user._id),
      )
      .take(MAX_GUARDIAN_LINKS)

    const children: Array<{
      orgStudentId: Id<'orgStudents'>
      organizationId?: string
      displayName: string
      classes: Array<{
        classId: Id<'classes'>
        name: string
        year: number
        archivedTime?: number
      }>
    }> = []

    for (const link of links) {
      const orgStudent = await ctx.db.get('orgStudents', link.orgStudentId)
      if (!orgStudent || orgStudent.organizationId !== link.organizationId) {
        continue
      }
      const relationExists = await guardianAuthz(
        orgStudent.organizationId,
      ).hasRelation(
        ctx,
        guardianSubject(user._id),
        GUARDIAN_RELATION,
        guardianObject(orgStudent._id),
      )
      if (!relationExists) {
        continue
      }

      const enrollments = await ctx.db
        .query('classEnrollments')
        .withIndex('by_orgStudentId', (index) =>
          index.eq('orgStudentId', orgStudent._id),
        )
        .take(MAX_STUDENT_ENROLLMENTS)
      const classes: Array<{
        classId: Id<'classes'>
        name: string
        year: number
        archivedTime?: number
      }> = []

      for (const enrollment of enrollments) {
        if (enrollment.status !== 'active') continue
        if (enrollment.organizationId !== orgStudent.organizationId) continue
        // Relation already verified for this orgStudent; only need the class doc.
        const classDoc = await ctx.db.get('classes', enrollment.classId)
        if (!classDoc) continue
        classes.push({
          classId: classDoc._id,
          name: classDoc.name,
          year: classDoc.year,
          archivedTime: classDoc.archivedTime,
        })
      }

      classes.sort(
        (left, right) =>
          right.year - left.year || left.name.localeCompare(right.name),
      )
      children.push({
        orgStudentId: orgStudent._id,
        organizationId: orgStudent.organizationId,
        displayName: formatOrgStudentName(orgStudent),
        classes,
      })
    }

    children.sort((left, right) =>
      left.displayName.localeCompare(right.displayName),
    )
    return children
  },
})

export const listGuardiansForStudent = query({
  args: {
    classId: v.id('classes'),
    orgStudentId: v.id('orgStudents'),
  },
  returns: v.array(listedGuardianValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireClassPermission(
      ctx,
      user._id,
      args.classId,
      'class:manageMembers',
    )

    const [classDoc, orgStudent, enrollment] = await Promise.all([
      ctx.db.get('classes', args.classId),
      ctx.db.get('orgStudents', args.orgStudentId),
      ctx.db
        .query('classEnrollments')
        .withIndex('by_classId_and_orgStudentId', (index) =>
          index
            .eq('classId', args.classId)
            .eq('orgStudentId', args.orgStudentId),
        )
        .unique(),
    ])
    if (
      !classDoc ||
      !orgStudent ||
      classDoc.organizationId !== orgStudent.organizationId ||
      enrollment?.organizationId !== classDoc.organizationId ||
      enrollment?.status !== 'active'
    ) {
      throw new Error('Student is not actively enrolled in this class')
    }

    const links = await listGuardianLinksForStudent(
      ctx,
      orgStudent._id,
      orgStudent.organizationId,
    )
    const guardians = await Promise.all(
      links.map(async (link) => {
        const guardian = await ctx.db.get('users', link.guardianUserId)
        return {
          guardianUserId: link.guardianUserId,
          name: guardian?.name,
          email: guardian?.email,
          linkedAt: link.linkedAt,
        }
      }),
    )
    return guardians
  },
})

export const listGuardianCodesForClass = internalQuery({
  args: {
    classId: v.id('classes'),
  },
  returns: v.object({
    className: v.string(),
    year: v.number(),
    organizationId: v.optional(v.string()),
    students: v.array(
      v.object({
        orgStudentId: v.id('orgStudents'),
        displayName: v.string(),
        guardianCode: v.string(),
        guardians: v.array(listedGuardianValidator),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireClassPermission(
      ctx,
      user._id,
      args.classId,
      'class:manageMembers',
    )
    return await loadGuardianCodesForClass(ctx, args.classId)
  },
})

export type GuardianCodesForClass = {
  className: string
  year: number
  organizationId?: string
  students: Array<{
    orgStudentId: Id<'orgStudents'>
    displayName: string
    guardianCode: string
    guardians: Array<{
      guardianUserId: Id<'users'>
      name?: string
      email?: string
      linkedAt: number
    }>
  }>
}

/** Load guardian codes for a class. Caller must already have authorized. */
export async function loadGuardianCodesForClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<'classes'>,
): Promise<GuardianCodesForClass> {
  const classDoc = await ctx.db.get('classes', classId)
  if (!classDoc) {
    throw new Error('Class not found')
  }

  const enrollments = await ctx.db
    .query('classEnrollments')
    .withIndex('by_classId', (index) => index.eq('classId', classDoc._id))
    .take(MAX_CLASS_STUDENTS + 1)
  if (enrollments.length > MAX_CLASS_STUDENTS) {
    throw new Error('Class is too large for a single guardian-code PDF')
  }

  const students: GuardianCodesForClass['students'] = []
  for (const enrollment of enrollments) {
    if (
      enrollment.status !== 'active' ||
      enrollment.organizationId !== classDoc.organizationId
    ) {
      continue
    }
    const orgStudent = await ctx.db.get('orgStudents', enrollment.orgStudentId)
    if (orgStudent && orgStudent.organizationId === classDoc.organizationId) {
      const links = await listGuardianLinksForStudent(
        ctx,
        orgStudent._id,
        orgStudent.organizationId,
      )
      const guardians = await Promise.all(
        links.map(async (link) => {
          const guardian = await ctx.db.get('users', link.guardianUserId)
          return {
            guardianUserId: link.guardianUserId,
            name: guardian?.name,
            email: guardian?.email,
            linkedAt: link.linkedAt,
          }
        }),
      )
      students.push({
        orgStudentId: orgStudent._id,
        displayName: formatClassStudentName(enrollment, orgStudent),
        guardianCode: orgStudent.guardianCode,
        guardians,
      })
    }
  }
  students.sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  )

  return {
    className: classDoc.name,
    year: classDoc.year,
    organizationId: classDoc.organizationId,
    students,
  }
}
