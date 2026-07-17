import { requireUser } from '#/lib/auth'
import { DEFAULT_CLASS_SORT, sortClasses } from '#/lib/classSort'
import { internalMutation, mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { v } from 'convex/values'
import { components, internal } from './_generated/api'
import { authz } from './authz'
import {
  CLASS_ROLES_BY_PRECEDENCE,
  classScope,
  hasClassPermission,
  highestClassRole,
  requireClassPermission,
} from './lib/classAuth'
import type { ClassRole } from './lib/classAuth'
import {
  ensureSoloStudentEnrollment,
  withdrawSoloStudentEnrollment,
} from './lib/soloRoster'
import {
  classDocWithMyRole,
  classRoleValidator,
  classSort,
  toPublicClass,
} from './classes'
import { loadGuardianCodesForClass } from './guardians'
import { tryRedeemGuardianCode } from './lib/guardianLinks'
import { rateLimiter } from './rateLimiter'
import { JOIN_CODE_LENGTH } from './lib/joinCodes'

type RedeemableRole = 'student' | 'classTeacher' | 'assistantTeacher'

async function findClassByCode(
  ctx: MutationCtx,
  code: string,
): Promise<{ doc: Doc<'classes'>; role: RedeemableRole } | null> {
  // Codes are unique across all three fields at generation time, so at most
  // one of these lookups matches; .unique() throws if that invariant breaks.
  const byStudent = await ctx.db
    .query('classes')
    .withIndex('by_studentCode', (q) => q.eq('studentCode', code))
    .unique()
  if (byStudent) return { doc: byStudent, role: 'student' }

  const byTeacher = await ctx.db
    .query('classes')
    .withIndex('by_teacherCode', (q) => q.eq('teacherCode', code))
    .unique()
  if (byTeacher) return { doc: byTeacher, role: 'classTeacher' }

  const byAssistant = await ctx.db
    .query('classes')
    .withIndex('by_assistantTeacherCode', (q) =>
      q.eq('assistantTeacherCode', code),
    )
    .unique()
  if (byAssistant) return { doc: byAssistant, role: 'assistantTeacher' }

  return null
}

const INVALID_CODE_ERROR = 'Invalid join code'
const RATE_LIMITED_ERROR = 'Too many attempts. Please try again later.'
const SOLO_BACKFILL_USERS_PER_BATCH = 20

const redeemableRoleValidator = v.union(
  v.literal('student'),
  v.literal('classTeacher'),
  v.literal('assistantTeacher'),
)

/**
 * Redeem a class join code without rate limiting (caller applies limits once).
 */
async function tryRedeemJoinCode(
  ctx: MutationCtx,
  user: Doc<'users'>,
  rawCode: string,
): Promise<
  | { ok: true; classId: Id<'classes'>; role: RedeemableRole }
  | { ok: false; error: string }
> {
  const code = rawCode.replace(/[\s\u2013-]/g, '').toUpperCase()
  if (code.length !== JOIN_CODE_LENGTH) {
    return { ok: false, error: INVALID_CODE_ERROR }
  }

  const match = await findClassByCode(ctx, code)
  // Generic error for both "no match" and "archived": never confirm that a
  // code was (once) valid.
  if (!match) {
    return { ok: false, error: INVALID_CODE_ERROR }
  }
  if (match.doc.archivedTime !== undefined) {
    return { ok: false, error: INVALID_CODE_ERROR }
  }

  // Org-class guard: org students go through the roster-linking path
  // (Phase 2, linkStudentUser). Same generic error — never confirm a valid
  // org student code to unauthenticated-to-roster callers.
  if (match.doc.organizationId !== undefined && match.role === 'student') {
    console.error('Org student join blocked (roster path required)', {
      classId: match.doc._id,
    })
    return { ok: false, error: INVALID_CODE_ERROR }
  }

  const scope = classScope(match.doc._id)

  // Idempotent: redeeming a code for a role you already hold succeeds
  // without double-assigning. Roles are additive — a creator redeeming a
  // teacher code keeps creator.
  const alreadyHasRole = await authz.hasRole(ctx, user._id, match.role, scope)
  if (!alreadyHasRole) {
    await authz.assignRole(ctx, user._id, match.role, scope)
  }
  if (match.role === 'student' && match.doc.organizationId === undefined) {
    await ensureSoloStudentEnrollment(ctx, user, match.doc._id)
  }

  return { ok: true, classId: match.doc._id, role: match.role }
}

async function applyJoinCodeRateLimits(
  ctx: MutationCtx,
  userId: Id<'users'>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const perUser = await rateLimiter.limit(ctx, 'joinCodePerUser', {
    key: userId,
  })
  if (!perUser.ok) {
    return { ok: false, error: RATE_LIMITED_ERROR }
  }
  const global = await rateLimiter.limit(ctx, 'joinCodeGlobal')
  if (!global.ok) {
    return { ok: false, error: RATE_LIMITED_ERROR }
  }
  return { ok: true }
}

// Failures are returned (not thrown) so rate-limit consumption commits — a
// thrown error would roll back the whole mutation, including the rate-limit
// write, making brute-force attempts free.
export const redeemJoinCode = mutation({
  args: {
    code: v.string(),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      classId: v.id('classes'),
      role: redeemableRoleValidator,
    }),
    v.object({
      ok: v.literal(false),
      error: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const limited = await applyJoinCodeRateLimits(ctx, user._id)
    if (!limited.ok) {
      return { ok: false as const, error: limited.error }
    }
    return await tryRedeemJoinCode(ctx, user, args.code)
  },
})

/**
 * Single rate-limit budget: try class join codes, then guardian codes.
 */
export const redeemJoinOrGuardianCode = mutation({
  args: {
    code: v.string(),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      kind: v.literal('class'),
      classId: v.id('classes'),
      role: redeemableRoleValidator,
    }),
    v.object({
      ok: v.literal(true),
      kind: v.literal('guardian'),
      orgStudentId: v.id('orgStudents'),
    }),
    v.object({
      ok: v.literal(false),
      error: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const limited = await applyJoinCodeRateLimits(ctx, user._id)
    if (!limited.ok) {
      return { ok: false as const, error: limited.error }
    }

    const classResult = await tryRedeemJoinCode(ctx, user, args.code)
    if (classResult.ok) {
      return {
        ok: true as const,
        kind: 'class' as const,
        classId: classResult.classId,
        role: classResult.role,
      }
    }

    // Only fall through on "invalid code" — preserve guardian-cap messages etc.
    if (classResult.error !== INVALID_CODE_ERROR) {
      return { ok: false as const, error: classResult.error }
    }

    const guardianResult = await tryRedeemGuardianCode(ctx, user._id, args.code)
    if (guardianResult.ok) {
      return {
        ok: true as const,
        kind: 'guardian' as const,
        orgStudentId: guardianResult.orgStudentId,
      }
    }
    return { ok: false as const, error: guardianResult.error }
  },
})

// Guardrail against pathological accounts, not an expected limit; roles are
// never revoked at year rollover, so long-tenured users accumulate classes.
const MAX_CLASS_ROLES = 200

export const listMyClasses = query({
  args: {
    includeArchived: v.optional(v.boolean()),
    archivedOnly: v.optional(v.boolean()),
    sort: v.optional(classSort),
  },
  returns: v.array(classDocWithMyRole),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const includeArchived = args.includeArchived ?? false
    const archivedOnly = args.archivedOnly ?? false
    const sort = args.sort ?? DEFAULT_CLASS_SORT

    const roles = await authz.getUserRoles(ctx, user._id)

    // Roles are additive (e.g. creator + student); collect all per class so
    // the highest one can be surfaced as the user's displayed role.
    const rolesByClassId = new Map<string, Array<string>>()
    const classIds: Array<Id<'classes'>> = []
    for (const entry of roles) {
      if (entry.scope?.type !== 'class') continue
      const held = rolesByClassId.get(entry.scope.id)
      if (held) {
        held.push(entry.role)
        continue
      }
      if (classIds.length >= MAX_CLASS_ROLES) continue
      rolesByClassId.set(entry.scope.id, [entry.role])
      classIds.push(entry.scope.id as Id<'classes'>)
    }

    const docs = await Promise.all(classIds.map((id) => ctx.db.get(id)))

    const classes = docs
      // Drop nulls: deleted classes leave orphaned role assignments behind.
      .filter((doc): doc is Doc<'classes'> => doc !== null)
      .filter((doc) => {
        if (archivedOnly) return doc.archivedTime !== undefined
        if (includeArchived) return true
        return doc.archivedTime === undefined
      })

    return sortClasses(classes, sort).map((doc) => {
      const held = rolesByClassId.get(doc._id) ?? []
      const myRole = highestClassRole(held) ?? undefined
      // classTeacher and creator both hold class:manage (creator inherits).
      const canManage =
        held.includes('creator') || held.includes('classTeacher')
      return {
        ...toPublicClass(doc),
        myRole,
        canManage,
      }
    })
  },
})

const memberValidator = v.object({
  userId: v.id('users'),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  role: classRoleValidator,
})

export type ClassMember = {
  userId: Id<'users'>
  name?: string
  email?: string
  role: ClassRole
}

/** Load roster members for a class. Caller must already have authorized. */
export async function loadClassMembers(
  ctx: QueryCtx | MutationCtx,
  classId: Id<'classes'>,
): Promise<Array<ClassMember>> {
  const scope = classScope(classId)
  const rolesByUserId = new Map<string, Array<string>>()

  for (const role of CLASS_ROLES_BY_PRECEDENCE) {
    const holders = await ctx.runQuery(
      components.authz.queries.getUsersWithRole,
      {
        tenantId: 'classclarus',
        role,
        scope,
      },
    )
    for (const holder of holders) {
      const held = rolesByUserId.get(holder.userId)
      if (held) {
        held.push(role)
      } else {
        rolesByUserId.set(holder.userId, [role])
      }
    }
  }

  const members: Array<ClassMember> = []

  for (const [userId, roles] of rolesByUserId) {
    const highest = highestClassRole(roles)
    if (!highest) continue
    const member = await ctx.db.get(userId as Id<'users'>)
    members.push({
      userId: userId as Id<'users'>,
      name: member?.name,
      email: member?.email,
      role: highest,
    })
  }

  members.sort((a, b) => {
    const aIdx = CLASS_ROLES_BY_PRECEDENCE.indexOf(a.role)
    const bIdx = CLASS_ROLES_BY_PRECEDENCE.indexOf(b.role)
    if (aIdx !== bIdx) return aIdx - bIdx
    return (a.name ?? a.email ?? a.userId).localeCompare(
      b.name ?? b.email ?? b.userId,
    )
  })

  return members
}

/** Roster members for a class. Gated on class:manage. */
export const listClassMembers = query({
  args: {
    classId: v.id('classes'),
  },
  returns: v.array(memberValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireClassPermission(ctx, user._id, args.classId, 'class:manage')
    return await loadClassMembers(ctx, args.classId)
  },
})

const joinCodesValidator = v.object({
  studentCode: v.string(),
  teacherCode: v.union(v.string(), v.null()),
  assistantTeacherCode: v.union(v.string(), v.null()),
})

const guardianRosterValidator = v.object({
  className: v.string(),
  year: v.number(),
  organizationId: v.optional(v.string()),
  students: v.array(
    v.object({
      orgStudentId: v.id('orgStudents'),
      displayName: v.string(),
      guardianCode: v.string(),
      guardians: v.array(
        v.object({
          guardianUserId: v.id('users'),
          name: v.optional(v.string()),
          linkedAt: v.number(),
        }),
      ),
    }),
  ),
})

/**
 * Single subscription for class manage UI: join codes, members (if creator),
 * and guardian roster. Gated on class:manageMembers.
 */
export const getClassAdminBundle = query({
  args: {
    classId: v.id('classes'),
  },
  returns: v.object({
    joinCodes: joinCodesValidator,
    members: v.array(memberValidator),
    guardianRoster: guardianRosterValidator,
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

    const [members, guardianRoster] = await Promise.all([
      canManage
        ? loadClassMembers(ctx, args.classId)
        : Promise.resolve([] as Array<ClassMember>),
      loadGuardianCodesForClass(ctx, args.classId),
    ])

    return {
      joinCodes: {
        studentCode: doc.studentCode,
        teacherCode: canManage ? doc.teacherCode : null,
        assistantTeacherCode: canManage ? doc.assistantTeacherCode : null,
      },
      members,
      guardianRoster,
    }
  },
})

/**
 * Revoke all class-scoped roles for a member. Requires class:manage.
 * Refuses removing the sole creator so the class cannot be left unmanaged.
 */
export const removeMember = mutation({
  args: {
    classId: v.id('classes'),
    userId: v.id('users'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx)
    await requireClassPermission(ctx, caller._id, args.classId, 'class:manage')

    const scope = classScope(args.classId)
    const classDoc = await ctx.db.get('classes', args.classId)
    if (!classDoc) {
      throw new Error('Class not found')
    }
    const targetIsStudent = await authz.hasRole(
      ctx,
      args.userId,
      'student',
      scope,
    )
    const targetIsCreator = await authz.hasRole(
      ctx,
      args.userId,
      'creator',
      scope,
    )
    if (targetIsCreator) {
      const creators = await ctx.runQuery(
        components.authz.queries.getUsersWithRole,
        {
          tenantId: 'classclarus',
          role: 'creator',
          scope,
        },
      )
      if (creators.length <= 1) {
        throw new Error('Cannot remove the only creator of this class')
      }
    }

    const revoked = await authz.revokeAllRoles(ctx, args.userId, scope)
    if (revoked === 0) {
      throw new Error('User is not a member of this class')
    }
    if (targetIsStudent && classDoc.organizationId === undefined) {
      await withdrawSoloStudentEnrollment(
        ctx,
        args.userId,
        args.classId,
        caller._id,
      )
    }

    return null
  },
})

export const backfillSoloRosters = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    classId: v.optional(v.id('classes')),
    userOffset: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let classId = args.classId
    let nextClassCursor = args.cursor

    if (classId === undefined) {
      const classPage = await ctx.db.query('classes').paginate({
        numItems: 1,
        cursor: args.cursor ?? null,
      })
      const classDoc = classPage.page.at(0)
      if (!classDoc) return null

      classId = classDoc._id
      nextClassCursor = classPage.isDone ? undefined : classPage.continueCursor
      if (classDoc.organizationId !== undefined) {
        if (!classPage.isDone) {
          await ctx.scheduler.runAfter(
            0,
            internal.memberships.backfillSoloRosters,
            { cursor: classPage.continueCursor },
          )
        }
        return null
      }
    }

    const classDoc = await ctx.db.get('classes', classId)
    if (!classDoc || classDoc.organizationId !== undefined) {
      if (nextClassCursor !== undefined) {
        await ctx.scheduler.runAfter(
          0,
          internal.memberships.backfillSoloRosters,
          { cursor: nextClassCursor },
        )
      }
      return null
    }

    const holders = await ctx.runQuery(
      components.authz.queries.getUsersWithRole,
      {
        tenantId: 'classclarus',
        role: 'student',
        scope: classScope(classId),
      },
    )
    const userOffset = args.userOffset ?? 0
    const batch = holders.slice(
      userOffset,
      userOffset + SOLO_BACKFILL_USERS_PER_BATCH,
    )
    for (const holder of batch) {
      const user = await ctx.db.get('users', holder.userId as Id<'users'>)
      if (user) {
        await ensureSoloStudentEnrollment(ctx, user, classId)
      }
    }

    const nextUserOffset = userOffset + batch.length
    if (nextUserOffset < holders.length) {
      await ctx.scheduler.runAfter(
        0,
        internal.memberships.backfillSoloRosters,
        {
          cursor: nextClassCursor,
          classId,
          userOffset: nextUserOffset,
        },
      )
    } else if (nextClassCursor !== undefined) {
      await ctx.scheduler.runAfter(
        0,
        internal.memberships.backfillSoloRosters,
        { cursor: nextClassCursor },
      )
    }
    return null
  },
})
