import { requireUser } from './lib/auth'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { v } from 'convex/values'
import { components } from './_generated/api'
import { authz } from './authz'
import {
  classScope,
  requireClassPermission,
} from './lib/classAuth'
import { generateUniqueJoinCode, JOIN_CODE_LENGTH } from './lib/joinCodes'
import {
  ensureSoloStudentEnrollment,
} from './lib/soloRoster'
import { orgScope } from '@djpanda/convex-tenants'
import { tenantsClient } from './tenants'
import type { SchoolOrgRole } from './tenants'

/** Mirrors schools.ts — keep in sync (VP/AVP can manage members, not settings). */
const MANAGE_MEMBERS_ROLES = new Set<string>([
  'owner',
  'principal',
  'vicePrincipal',
  'assistantVicePrincipal',
  'admin',
])

async function requireSchoolManageMembersAccess(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  schoolId: string,
) {
  const member = await tenantsClient.getMember(ctx, schoolId, userId)
  if (!member || member.status === 'suspended') {
    throw new Error('Not a member of this school')
  }
  if (!MANAGE_MEMBERS_ROLES.has(member.role)) {
    throw new Error('Not allowed to manage school members')
  }
  return member
}

export const INVITE_TTL_HOURS = [1, 6, 12, 24, 48, 72] as const
export type InviteTtlHours = (typeof INVITE_TTL_HOURS)[number]
export const MAX_INVITE_TTL_HOURS = 72
export const MAX_INVITE_USES = 100
export const INVITE_MAX_USES_PRESETS = [1, 5, 10, 25, 50] as const

const HOUR_MS = 60 * 60 * 1000

export const INVALID_CODE_ERROR = 'Invalid join code'
export const EXPIRED_CODE_ERROR = 'This invite code has expired'
export const EXHAUSTED_CODE_ERROR = 'This invite code has no uses left'
export const REVOKED_CODE_ERROR = 'This invite code has been revoked'

export const classInviteRoleValidator = v.union(
  v.literal('student'),
  v.literal('classTeacher'),
  v.literal('assistantTeacher'),
)

export const schoolInviteRoleValidator = v.union(
  v.literal('principal'),
  v.literal('vicePrincipal'),
  v.literal('assistantVicePrincipal'),
  v.literal('teacher'),
  v.literal('admin'),
)

const inviteTtlHoursValidator = v.union(
  v.literal(1),
  v.literal(6),
  v.literal(12),
  v.literal(24),
  v.literal(48),
  v.literal(72),
)

const invitePublicValidator = v.object({
  _id: v.id('inviteCodes'),
  code: v.string(),
  scope: v.union(v.literal('class'), v.literal('school')),
  role: v.string(),
  createdAt: v.number(),
  expiresAt: v.number(),
  maxUses: v.union(v.number(), v.null()),
  useCount: v.number(),
  remainingUses: v.union(v.number(), v.null()),
})

export type InvitePublic = {
  _id: Id<'inviteCodes'>
  code: string
  scope: 'class' | 'school'
  role: string
  createdAt: number
  expiresAt: number
  maxUses: number | null
  useCount: number
  remainingUses: number | null
}

function toInvitePublic(doc: Doc<'inviteCodes'>): InvitePublic {
  const maxUses = doc.maxUses ?? null
  return {
    _id: doc._id,
    code: doc.code,
    scope: doc.scope,
    role: doc.role,
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt,
    maxUses,
    useCount: doc.useCount,
    remainingUses:
      maxUses === null ? null : Math.max(0, maxUses - doc.useCount),
  }
}

function isInviteActive(doc: Doc<'inviteCodes'>, now: number): boolean {
  if (doc.revokedAt !== undefined) return false
  if (doc.expiresAt <= now) return false
  if (doc.maxUses !== undefined && doc.useCount >= doc.maxUses) return false
  return true
}

function validateMaxUses(maxUses: number | undefined): number | undefined {
  if (maxUses === undefined) return undefined
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > MAX_INVITE_USES) {
    throw new Error(`Max uses must be between 1 and ${MAX_INVITE_USES}`)
  }
  return maxUses
}

function validateTtlHours(ttlHours: number): InviteTtlHours {
  if (!(INVITE_TTL_HOURS as readonly number[]).includes(ttlHours)) {
    throw new Error('Invalid invite duration')
  }
  if (ttlHours > MAX_INVITE_TTL_HOURS) {
    throw new Error(`Invite duration cannot exceed ${MAX_INVITE_TTL_HOURS} hours`)
  }
  return ttlHours as InviteTtlHours
}

type ClassInviteRole = 'student' | 'classTeacher' | 'assistantTeacher'
type SchoolInviteRole =
  | 'principal'
  | 'vicePrincipal'
  | 'assistantVicePrincipal'
  | 'teacher'
  | 'admin'

const SCHOOL_INVITE_ROLES = new Set<string>([
  'principal',
  'vicePrincipal',
  'assistantVicePrincipal',
  'teacher',
  'admin',
])

function isSchoolInviteRole(role: string): role is SchoolInviteRole {
  return SCHOOL_INVITE_ROLES.has(role)
}

function isClassInviteRole(role: string): role is ClassInviteRole {
  return (
    role === 'student' ||
    role === 'classTeacher' ||
    role === 'assistantTeacher'
  )
}

async function createInviteRow(
  ctx: MutationCtx,
  args: {
    scope: 'class' | 'school'
    classId?: Id<'classes'>
    organizationId?: string
    role: string
    createdBy: Id<'users'>
    ttlHours: number
    maxUses?: number
  },
): Promise<InvitePublic> {
  const ttlHours = validateTtlHours(args.ttlHours)
  const maxUses = validateMaxUses(args.maxUses)
  const now = Date.now()
  const code = await generateUniqueJoinCode(ctx)
  const id = await ctx.db.insert('inviteCodes', {
    code,
    scope: args.scope,
    classId: args.classId,
    organizationId: args.organizationId,
    role: args.role,
    createdBy: args.createdBy,
    createdAt: now,
    expiresAt: now + ttlHours * HOUR_MS,
    maxUses,
    useCount: 0,
  })
  const doc = await ctx.db.get(id)
  if (!doc) throw new Error('Failed to create invite')
  return toInvitePublic(doc)
}

export const createClassInvite = mutation({
  args: {
    classId: v.id('classes'),
    role: classInviteRoleValidator,
    ttlHours: inviteTtlHoursValidator,
    maxUses: v.optional(v.number()),
  },
  returns: invitePublicValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireClassPermission(
      ctx,
      user._id,
      args.classId,
      'class:manageMembers',
    )
    const classDoc = await ctx.db.get(args.classId)
    if (!classDoc) throw new Error('Class not found')
    if (classDoc.archivedTime !== undefined) {
      throw new Error('Cannot create invites for an archived class')
    }
    // Org students join via roster linking, not invite codes.
    if (
      classDoc.organizationId !== undefined &&
      args.role === 'student'
    ) {
      throw new Error(
        'Student invites are not available for school classes; add students to the roster instead',
      )
    }
    return await createInviteRow(ctx, {
      scope: 'class',
      classId: args.classId,
      role: args.role,
      createdBy: user._id,
      ttlHours: args.ttlHours,
      maxUses: args.maxUses,
    })
  },
})

export const createSchoolInvite = mutation({
  args: {
    schoolId: v.string(),
    role: schoolInviteRoleValidator,
    ttlHours: inviteTtlHoursValidator,
    maxUses: v.optional(v.number()),
  },
  returns: invitePublicValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireSchoolManageMembersAccess(ctx, user._id, args.schoolId)
    const org = await tenantsClient.getOrganization(ctx, args.schoolId)
    if (!org || org.status === 'archived' || org.status === 'suspended') {
      throw new Error('School is not active')
    }
    return await createInviteRow(ctx, {
      scope: 'school',
      organizationId: args.schoolId,
      role: args.role,
      createdBy: user._id,
      ttlHours: args.ttlHours,
      maxUses: args.maxUses,
    })
  },
})

export const listClassInvites = query({
  args: {
    classId: v.id('classes'),
    now: v.number(),
  },
  returns: v.array(invitePublicValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireClassPermission(
      ctx,
      user._id,
      args.classId,
      'class:manageMembers',
    )
    const rows = await ctx.db
      .query('inviteCodes')
      .withIndex('by_classId_and_createdAt', (q) =>
        q.eq('classId', args.classId),
      )
      .order('desc')
      .take(100)
    return rows
      .filter((row) => isInviteActive(row, args.now))
      .map(toInvitePublic)
  },
})

export const listSchoolInvites = query({
  args: {
    schoolId: v.string(),
    now: v.number(),
  },
  returns: v.array(invitePublicValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireSchoolManageMembersAccess(ctx, user._id, args.schoolId)
    const rows = await ctx.db
      .query('inviteCodes')
      .withIndex('by_organizationId_and_createdAt', (q) =>
        q.eq('organizationId', args.schoolId),
      )
      .order('desc')
      .take(100)
    return rows
      .filter((row) => isInviteActive(row, args.now))
      .map(toInvitePublic)
  },
})

export const revokeInvite = mutation({
  args: { inviteId: v.id('inviteCodes') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const invite = await ctx.db.get(args.inviteId)
    if (!invite) throw new Error('Invite not found')
    if (invite.revokedAt !== undefined) return null

    if (invite.scope === 'class') {
      if (!invite.classId) throw new Error('Invite not found')
      await requireClassPermission(
        ctx,
        user._id,
        invite.classId,
        'class:manageMembers',
      )
    } else {
      if (!invite.organizationId) throw new Error('Invite not found')
      await requireSchoolManageMembersAccess(ctx, user._id, invite.organizationId)
    }

    await ctx.db.patch(args.inviteId, { revokedAt: Date.now() })
    return null
  },
})

function normalizeCode(rawCode: string): string {
  return rawCode.replace(/[\s\u2013-]/g, '').toUpperCase()
}

/**
 * Redeem a time-limited invite code (caller applies rate limits once).
 * Legacy forever class/school codes are intentionally not accepted.
 */
export async function tryRedeemInviteCode(
  ctx: MutationCtx,
  user: Doc<'users'>,
  rawCode: string,
): Promise<
  | {
      ok: true
      kind: 'class'
      classId: Id<'classes'>
      role: ClassInviteRole
    }
  | {
      ok: true
      kind: 'school'
      schoolId: string
      role: SchoolOrgRole
    }
  | { ok: false; error: string }
> {
  const code = normalizeCode(rawCode)
  if (code.length !== JOIN_CODE_LENGTH) {
    return { ok: false, error: INVALID_CODE_ERROR }
  }

  const invite = await ctx.db
    .query('inviteCodes')
    .withIndex('by_code', (q) => q.eq('code', code))
    .unique()

  if (!invite) {
    return { ok: false, error: INVALID_CODE_ERROR }
  }

  if (invite.revokedAt !== undefined) {
    return { ok: false, error: REVOKED_CODE_ERROR }
  }

  const now = Date.now()
  if (invite.expiresAt <= now) {
    return { ok: false, error: EXPIRED_CODE_ERROR }
  }

  if (invite.maxUses !== undefined && invite.useCount >= invite.maxUses) {
    return { ok: false, error: EXHAUSTED_CODE_ERROR }
  }

  if (invite.scope === 'class') {
    if (!invite.classId || !isClassInviteRole(invite.role)) {
      return { ok: false, error: INVALID_CODE_ERROR }
    }
    const classDoc = await ctx.db.get(invite.classId)
    if (!classDoc || classDoc.archivedTime !== undefined) {
      return { ok: false, error: INVALID_CODE_ERROR }
    }
    if (
      classDoc.organizationId !== undefined &&
      invite.role === 'student'
    ) {
      return { ok: false, error: INVALID_CODE_ERROR }
    }

    const scope = classScope(invite.classId)
    const alreadyHasRole = await authz.hasRole(
      ctx,
      user._id,
      invite.role,
      scope,
    )
    if (!alreadyHasRole) {
      await authz.assignRole(ctx, user._id, invite.role, scope)
      await ctx.db.patch(invite._id, { useCount: invite.useCount + 1 })
    }
    if (invite.role === 'student' && classDoc.organizationId === undefined) {
      await ensureSoloStudentEnrollment(ctx, user, invite.classId)
    }
    return {
      ok: true,
      kind: 'class',
      classId: invite.classId,
      role: invite.role,
    }
  }

  if (!invite.organizationId || !isSchoolInviteRole(invite.role)) {
    return { ok: false, error: INVALID_CODE_ERROR }
  }

  const org = await tenantsClient.getOrganization(ctx, invite.organizationId)
  if (!org || org.status === 'archived' || org.status === 'suspended') {
    return { ok: false, error: INVALID_CODE_ERROR }
  }

  const existing = await tenantsClient.getMember(
    ctx,
    invite.organizationId,
    user._id,
  )
  if (existing && existing.status !== 'suspended') {
    const role =
      existing.role === 'owner' ||
      existing.role === 'admin' ||
      existing.role === 'principal' ||
      existing.role === 'vicePrincipal' ||
      existing.role === 'assistantVicePrincipal' ||
      existing.role === 'teacher' ||
      existing.role === 'member'
        ? existing.role
        : invite.role
    return { ok: true, kind: 'school', schoolId: invite.organizationId, role }
  }

  await ctx.runMutation(components.tenants.members.addMember, {
    userId: user._id,
    organizationId: invite.organizationId,
    memberUserId: user._id,
    role: invite.role,
  })
  await authz
    .withTenant(invite.organizationId)
    .assignRole(
      ctx,
      user._id,
      invite.role,
      orgScope(invite.organizationId),
      undefined,
      user._id,
    )
  await ctx.db.patch(invite._id, { useCount: invite.useCount + 1 })

  return {
    ok: true,
    kind: 'school',
    schoolId: invite.organizationId,
    role: invite.role,
  }
}
