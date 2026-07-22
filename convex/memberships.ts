import { getCurrentUser, requireUser } from './lib/auth'
import { DEFAULT_CLASS_SORT, sortClasses } from './lib/classSort'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { v } from 'convex/values'
import { components, internal } from './_generated/api'
import { authz } from './authz'
import {
  CLASS_ROLES_BY_PRECEDENCE,
  classScope,
  highestClassRole,
  requireClassPermission,
} from './lib/classAuth'
import type { ClassRole } from './lib/classAuth'
import {
  ensureSoloStudentEnrollment,
  withdrawSoloStudentEnrollment,
} from './lib/soloRoster'
import { formatOrgStudentName } from './lib/studentNames'
import {
  classDocWithMyRole,
  classRoleValidator,
  classSort,
  toPublicClass,
} from './classes'
import {
  listSchoolsForUser,
  getSchoolNameMap,
  schoolDocPublic,
} from './schools'
import { loadGuardianCodesForClass } from './guardians'
import { tryRedeemGuardianCode } from './lib/guardianLinks'
import { tryRedeemInviteCode, INVALID_CODE_ERROR } from './inviteCodes'
import { rateLimiter } from './rateLimiter'
import {
  GUARDIAN_RELATION,
  guardianAuthz,
  guardianObject,
  guardianSubject,
} from './lib/guardianAuth'

type RedeemableRole = 'student' | 'classTeacher' | 'assistantTeacher'

const RATE_LIMITED_ERROR = 'Too many attempts. Please try again later.'
const SOLO_BACKFILL_USERS_PER_BATCH = 20

const redeemableRoleValidator = v.union(
  v.literal('student'),
  v.literal('classTeacher'),
  v.literal('assistantTeacher'),
)

const schoolRedeemRoleValidator = v.union(
  v.literal('owner'),
  v.literal('admin'),
  v.literal('principal'),
  v.literal('vicePrincipal'),
  v.literal('assistantVicePrincipal'),
  v.literal('teacher'),
  v.literal('member'),
)

/**
 * Redeem a class invite code without rate limiting (caller applies limits once).
 * Legacy forever class codes are intentionally not accepted.
 */
async function tryRedeemJoinCode(
  ctx: MutationCtx,
  user: Doc<'users'>,
  rawCode: string,
): Promise<
  | { ok: true; classId: Id<'classes'>; role: RedeemableRole }
  | { ok: false; error: string }
> {
  const result = await tryRedeemInviteCode(ctx, user, rawCode)
  if (!result.ok) return result
  if (result.kind !== 'class') {
    return { ok: false, error: INVALID_CODE_ERROR }
  }
  return { ok: true, classId: result.classId, role: result.role }
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
 * Single rate-limit budget: try invite codes (class/school), then guardian codes.
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
      kind: v.literal('school'),
      schoolId: v.string(),
      role: schoolRedeemRoleValidator,
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

    const inviteResult = await tryRedeemInviteCode(ctx, user, args.code)
    if (inviteResult.ok) {
      if (inviteResult.kind === 'class') {
        return {
          ok: true as const,
          kind: 'class' as const,
          classId: inviteResult.classId,
          role: inviteResult.role,
        }
      }
      return {
        ok: true as const,
        kind: 'school' as const,
        schoolId: inviteResult.schoolId,
        role: inviteResult.role,
      }
    }

    // Only fall through on "invalid code" — preserve expired/exhausted/revoked.
    if (inviteResult.error !== INVALID_CODE_ERROR) {
      return { ok: false as const, error: inviteResult.error }
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
const MAX_GUARDIAN_LINKS = 100
const MAX_STUDENT_ENROLLMENTS = 200

function matchesArchivedFilter(
  doc: Doc<'classes'>,
  includeArchived: boolean,
  archivedOnly: boolean,
): boolean {
  if (archivedOnly) return doc.archivedTime !== undefined
  if (includeArchived) return true
  return doc.archivedTime === undefined
}

/** Verified guardian links with their org student (ReBAC checked). */
async function listVerifiedGuardianLinks(
  ctx: QueryCtx,
  userId: Id<'users'>,
): Promise<
  Array<{
    orgStudent: Doc<'orgStudents'>
  }>
> {
  const links = await ctx.db
    .query('guardianLinks')
    .withIndex('by_guardianUserId', (index) =>
      index.eq('guardianUserId', userId),
    )
    .take(MAX_GUARDIAN_LINKS)

  const verified: Array<{ orgStudent: Doc<'orgStudents'> }> = []
  for (const link of links) {
    const orgStudent = await ctx.db.get('orgStudents', link.orgStudentId)
    if (!orgStudent || orgStudent.organizationId !== link.organizationId) {
      continue
    }

    const relationExists = await guardianAuthz(
      orgStudent.organizationId,
    ).hasRelation(
      ctx,
      guardianSubject(userId),
      GUARDIAN_RELATION,
      guardianObject(orgStudent._id),
    )
    if (!relationExists) continue

    verified.push({ orgStudent })
  }
  return verified
}

/** Unique class docs reachable via the user's guardian links + active enrollments. */
async function listGuardianAccessibleClasses(
  ctx: QueryCtx,
  userId: Id<'users'>,
): Promise<Array<Doc<'classes'>>> {
  const byId = new Map<string, Doc<'classes'>>()
  const verified = await listVerifiedGuardianLinks(ctx, userId)

  for (const { orgStudent } of verified) {
    const enrollments = await ctx.db
      .query('classEnrollments')
      .withIndex('by_orgStudentId', (index) =>
        index.eq('orgStudentId', orgStudent._id),
      )
      .take(MAX_STUDENT_ENROLLMENTS)

    for (const enrollment of enrollments) {
      if (enrollment.status !== 'active') continue
      if (enrollment.organizationId !== orgStudent.organizationId) continue
      if (byId.has(enrollment.classId)) continue

      const classDoc = await ctx.db.get('classes', enrollment.classId)
      if (!classDoc) continue
      byId.set(classDoc._id, classDoc)
    }
  }

  return [...byId.values()]
}

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

    const rosterClasses = docs
      // Drop nulls: deleted classes leave orphaned role assignments behind.
      .filter((doc): doc is Doc<'classes'> => doc !== null)
      .filter((doc) =>
        matchesArchivedFilter(doc, includeArchived, archivedOnly),
      )

    const rosterIdSet = new Set(rosterClasses.map((doc) => doc._id))
    const guardianOnly: Array<Doc<'classes'>> = []
    if (rosterClasses.length < MAX_CLASS_ROLES) {
      const guardianDocs = await listGuardianAccessibleClasses(ctx, user._id)
      for (const doc of guardianDocs) {
        if (rosterIdSet.has(doc._id)) continue
        if (!matchesArchivedFilter(doc, includeArchived, archivedOnly)) continue
        if (rosterClasses.length + guardianOnly.length >= MAX_CLASS_ROLES) break
        guardianOnly.push(doc)
      }
    }

    const classes = [...rosterClasses, ...guardianOnly]

    const schoolIds = classes
      .map((doc) => doc.organizationId)
      .filter((id): id is string => id !== undefined)
    const schoolNames = await getSchoolNameMap(ctx, user._id, schoolIds)

    return sortClasses(classes, sort).map((doc) => {
      const school =
        doc.organizationId !== undefined
          ? {
              id: doc.organizationId,
              name: schoolNames.get(doc.organizationId) ?? 'School',
            }
          : undefined
      const held = rolesByClassId.get(doc._id)
      if (held) {
        const myRole = highestClassRole(held) ?? undefined
        // classTeacher and creator both hold class:manage (creator inherits).
        const canManage =
          held.includes('creator') || held.includes('classTeacher')
        return {
          ...toPublicClass(doc),
          myRole,
          canManage,
          school,
        }
      }
      return {
        ...toPublicClass(doc),
        myRole: 'guardian' as const,
        canManage: false,
        school,
      }
    })
  },
})

const accountChildClassValidator = v.object({
  classId: v.id('classes'),
  name: v.string(),
  year: v.number(),
  archivedTime: v.optional(v.number()),
})

const accountChildValidator = v.object({
  orgStudentId: v.id('orgStudents'),
  organizationId: v.optional(v.string()),
  displayName: v.string(),
  classes: v.array(accountChildClassValidator),
})

async function listMyChildrenForAccountHome(
  ctx: QueryCtx,
  userId: Id<'users'>,
): Promise<
  Array<{
    orgStudentId: Id<'orgStudents'>
    organizationId?: string
    displayName: string
    classes: Array<{
      classId: Id<'classes'>
      name: string
      year: number
      archivedTime?: number
    }>
  }>
> {
  // Keep these mirrored with `convex/guardians.ts` since we embed the “list
  // children” logic into a single home bundle query.
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

  const verified = await listVerifiedGuardianLinks(ctx, userId)

  for (const { orgStudent } of verified) {
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

      // Relation already verified for this orgStudent; only need the class
      // document.
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
}

// One subscription for the authenticated “home” surface:
// - classes (active + archived) for the ClassList
// - schools (active + archived) for the SchoolList
// - linked student children for the LinkedStudentsSection
export const getAccountHome = query({
  args: {},
  returns: v.union(
    v.object({
      user: v.object({
        _id: v.id('users'),
      }),
      classes: v.array(classDocWithMyRole),
      schools: v.array(schoolDocPublic),
      children: v.array(accountChildValidator),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null

    const roles = await authz.getUserRoles(ctx, user._id)

    // Roles are additive (e.g. creator + student). Collect per class.
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
    const classDocs = docs.filter((doc): doc is Doc<'classes'> => doc !== null)

    const schoolIds = classDocs
      .map((doc) => doc.organizationId)
      .filter((id): id is string => id !== undefined)
    const schoolNames = await getSchoolNameMap(ctx, user._id, schoolIds)

    const classes = sortClasses(classDocs, DEFAULT_CLASS_SORT).map((doc) => {
      const held = rolesByClassId.get(doc._id) ?? []
      const myRole = highestClassRole(held) ?? undefined
      const canManage =
        held.includes('creator') || held.includes('classTeacher')
      const school =
        doc.organizationId !== undefined
          ? {
              id: doc.organizationId,
              name: schoolNames.get(doc.organizationId) ?? 'School',
            }
          : undefined
      return {
        ...toPublicClass(doc),
        myRole,
        canManage,
        school,
      }
    })

    return {
      user: { _id: user._id },
      classes,
      schools: await listSchoolsForUser(ctx, user._id),
      children: await listMyChildrenForAccountHome(ctx, user._id),
    }
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
export const listClassMembers = internalQuery({
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
          email: v.optional(v.string()),
          linkedAt: v.number(),
        }),
      ),
    }),
  ),
})

/**
 * Single subscription for class manage UI: members and guardian roster.
 * Gated on class:manageMembers. Invites are listed via inviteCodes.listClassInvites.
 */
export const getClassAdminBundle = query({
  args: {
    classId: v.id('classes'),
  },
  returns: v.object({
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

    // `class:manageMembers` is granted only by `creator` and `classTeacher`
    // roles, and those roles also include `class:manage`.
    const [members, guardianRoster] = await Promise.all([
      loadClassMembers(ctx, args.classId),
      loadGuardianCodesForClass(ctx, args.classId),
    ])

    return {
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
