import { generateSlug, orgScope } from '@djpanda/convex-tenants'
import { requireUser } from '#/lib/auth'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { components } from './_generated/api'
import { authz } from './authz'
import {
  classScope,
  hasClassPermission,
  requireClassPermission,
} from './lib/classAuth'
import { generateUniqueJoinCode, JOIN_CODE_LENGTH } from './lib/joinCodes'
import { tenantsClient, SCHOOL_ORG_ROLES } from './tenants'
import type { SchoolOrgRole } from './tenants'
import { rateLimiter } from './rateLimiter'
import { v } from 'convex/values'

export const schoolOrgRoleValidator = v.union(
  v.literal('owner'),
  v.literal('admin'),
  v.literal('principal'),
  v.literal('teacher'),
  v.literal('member'),
)

export const schoolStatusValidator = v.union(
  v.literal('active'),
  v.literal('suspended'),
  v.literal('archived'),
)

/** Compact school card shape for home + switchers. */
export const schoolDocPublic = v.object({
  _id: v.string(),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  logo: v.union(v.string(), v.null()),
  status: schoolStatusValidator,
  myRole: schoolOrgRoleValidator,
  canManage: v.boolean(),
  canManageMembers: v.boolean(),
})

export type SchoolPublic = {
  _id: string
  _creationTime: number
  name: string
  slug: string
  logo: string | null
  status: 'active' | 'suspended' | 'archived'
  myRole: SchoolOrgRole
  canManage: boolean
  canManageMembers: boolean
}

const MANAGE_ROLES = new Set<string>(['owner', 'principal', 'admin'])
const MANAGE_MEMBERS_ROLES = new Set<string>(['owner', 'principal', 'admin'])

function isSchoolOrgRole(role: string): role is SchoolOrgRole {
  return (SCHOOL_ORG_ROLES as readonly string[]).includes(role)
}

function toSchoolPublic(org: {
  _id: string
  _creationTime: number
  name: string
  slug: string
  logo: string | null
  status?: 'active' | 'suspended' | 'archived'
  role: string
}): SchoolPublic {
  const myRole = isSchoolOrgRole(org.role) ? org.role : 'member'
  return {
    _id: org._id,
    _creationTime: org._creationTime,
    name: org.name,
    slug: org.slug,
    logo: org.logo,
    status: org.status ?? 'active',
    myRole,
    canManage: MANAGE_ROLES.has(myRole),
    canManageMembers: MANAGE_MEMBERS_ROLES.has(myRole),
  }
}

export async function listSchoolsForUser(
  ctx: QueryCtx,
  userId: Id<'users'>,
): Promise<Array<SchoolPublic>> {
  const orgs = await tenantsClient.listOrganizations(ctx, userId, {
    sortBy: 'name',
    sortOrder: 'asc',
  })
  return orgs
    .filter((org) => {
      const type = org.metadata?.type
      // Treat missing type as school (legacy / early creates).
      return type === undefined || type === 'school'
    })
    .map((org) => toSchoolPublic(org))
}

export async function getSchoolNameMap(
  ctx: QueryCtx,
  userId: Id<'users'>,
  organizationIds: Array<string>,
): Promise<Map<string, string>> {
  const unique = [...new Set(organizationIds.filter(Boolean))]
  const map = new Map<string, string>()
  if (unique.length === 0) return map

  // Prefer membership list (one round-trip) then fall back to getOrganization.
  const orgs = await tenantsClient.listOrganizations(ctx, userId)
  for (const org of orgs) {
    if (unique.includes(org._id)) {
      map.set(org._id, org.name)
    }
  }
  for (const id of unique) {
    if (map.has(id)) continue
    const org = await tenantsClient.getOrganization(ctx, id)
    if (org) map.set(id, org.name)
  }
  return map
}

async function requireSchoolMember(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  schoolId: string,
) {
  const member = await tenantsClient.getMember(ctx, schoolId, userId)
  if (!member || member.status === 'suspended') {
    throw new Error('Not a member of this school')
  }
  return member
}

async function requireSchoolManageMembers(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  schoolId: string,
) {
  const member = await requireSchoolMember(ctx, userId, schoolId)
  if (!MANAGE_MEMBERS_ROLES.has(member.role)) {
    throw new Error('Not allowed to manage school members')
  }
  return member
}

type SchoolJoinCodeType = 'principal' | 'teacher' | 'admin'

const schoolJoinCodeTypeValidator = v.union(
  v.literal('principal'),
  v.literal('teacher'),
  v.literal('admin'),
)

const SCHOOL_CODE_ROLE: Record<SchoolJoinCodeType, SchoolOrgRole> = {
  principal: 'principal',
  teacher: 'teacher',
  admin: 'admin',
}

async function insertSchoolJoinCodes(
  ctx: MutationCtx,
  organizationId: string,
): Promise<Doc<'schoolJoinCodes'>> {
  const principalCode = await generateUniqueJoinCode(ctx)
  const teacherCode = await generateUniqueJoinCode(ctx, [principalCode])
  const adminCode = await generateUniqueJoinCode(ctx, [
    principalCode,
    teacherCode,
  ])
  const id = await ctx.db.insert('schoolJoinCodes', {
    organizationId,
    principalCode,
    teacherCode,
    adminCode,
  })
  const doc = await ctx.db.get(id)
  if (!doc) throw new Error('Failed to create school join codes')
  return doc
}

async function getOrCreateSchoolJoinCodes(
  ctx: MutationCtx,
  organizationId: string,
): Promise<Doc<'schoolJoinCodes'>> {
  const existing = await ctx.db
    .query('schoolJoinCodes')
    .withIndex('by_organizationId', (q) =>
      q.eq('organizationId', organizationId),
    )
    .unique()
  if (existing) return existing
  return await insertSchoolJoinCodes(ctx, organizationId)
}

async function findSchoolByJoinCode(
  ctx: MutationCtx,
  code: string,
): Promise<{ organizationId: string; role: SchoolOrgRole } | null> {
  const byPrincipal = await ctx.db
    .query('schoolJoinCodes')
    .withIndex('by_principalCode', (q) => q.eq('principalCode', code))
    .unique()
  if (byPrincipal) {
    return {
      organizationId: byPrincipal.organizationId,
      role: SCHOOL_CODE_ROLE.principal,
    }
  }
  const byTeacher = await ctx.db
    .query('schoolJoinCodes')
    .withIndex('by_teacherCode', (q) => q.eq('teacherCode', code))
    .unique()
  if (byTeacher) {
    return {
      organizationId: byTeacher.organizationId,
      role: SCHOOL_CODE_ROLE.teacher,
    }
  }
  const byAdmin = await ctx.db
    .query('schoolJoinCodes')
    .withIndex('by_adminCode', (q) => q.eq('adminCode', code))
    .unique()
  if (byAdmin) {
    return {
      organizationId: byAdmin.organizationId,
      role: SCHOOL_CODE_ROLE.admin,
    }
  }
  return null
}

/**
 * Redeem a school staff join code (caller applies rate limits once).
 */
export async function tryRedeemSchoolJoinCode(
  ctx: MutationCtx,
  user: Doc<'users'>,
  rawCode: string,
): Promise<
  | { ok: true; schoolId: string; role: SchoolOrgRole }
  | { ok: false; error: string }
> {
  const code = rawCode.replace(/[\s\u2013-]/g, '').toUpperCase()
  if (code.length !== JOIN_CODE_LENGTH) {
    return { ok: false, error: 'Invalid join code' }
  }

  const match = await findSchoolByJoinCode(ctx, code)
  if (!match) {
    return { ok: false, error: 'Invalid join code' }
  }

  const org = await tenantsClient.getOrganization(ctx, match.organizationId)
  if (!org || org.status === 'archived' || org.status === 'suspended') {
    return { ok: false, error: 'Invalid join code' }
  }

  const existing = await tenantsClient.getMember(
    ctx,
    match.organizationId,
    user._id,
  )
  if (existing && existing.status !== 'suspended') {
    const role = isSchoolOrgRole(existing.role) ? existing.role : match.role
    return { ok: true, schoolId: match.organizationId, role }
  }

  // Self-join via code: write membership + authz without members:add (joiners
  // are not yet org members). Mirrors invitation accept semantics.
  await ctx.runMutation(components.tenants.members.addMember, {
    userId: user._id,
    organizationId: match.organizationId,
    memberUserId: user._id,
    role: match.role,
  })
  await authz
    .withTenant(match.organizationId)
    .assignRole(
      ctx,
      user._id,
      match.role,
      orgScope(match.organizationId),
      undefined,
      user._id,
    )

  return { ok: true, schoolId: match.organizationId, role: match.role }
}

export const listMySchools = query({
  args: {},
  returns: v.array(schoolDocPublic),
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    return await listSchoolsForUser(ctx, user._id)
  },
})

export const getSchool = query({
  args: { schoolId: v.string() },
  returns: v.union(schoolDocPublic, v.null()),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const org = await tenantsClient.getOrganization(ctx, args.schoolId)
    if (!org) return null
    const member = await tenantsClient.getMember(ctx, args.schoolId, user._id)
    if (!member || member.status === 'suspended') return null
    return toSchoolPublic({ ...org, role: member.role })
  },
})

export const createSchool = mutation({
  args: {
    name: v.string(),
    slug: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const name = args.name.trim()
    if (!name) throw new Error('School name is required')
    const slug = (args.slug?.trim() || generateSlug(name)).toLowerCase()
    const organizationId = await tenantsClient.createOrganization(
      ctx,
      user._id,
      name,
      {
        slug,
        metadata: { type: 'school' },
      },
    )
    await insertSchoolJoinCodes(ctx, organizationId)
    return organizationId
  },
})

export const updateSchool = mutation({
  args: {
    schoolId: v.string(),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireSchoolMember(ctx, user._id, args.schoolId)
    const updates: {
      name?: string
      slug?: string
    } = {}
    if (args.name !== undefined) {
      const name = args.name.trim()
      if (!name) throw new Error('School name is required')
      updates.name = name
    }
    if (args.slug !== undefined) {
      updates.slug = args.slug.trim().toLowerCase()
    }
    await tenantsClient.updateOrganization(ctx, user._id, args.schoolId, updates)
    return null
  },
})

export const archiveSchool = mutation({
  args: { schoolId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireSchoolMember(ctx, user._id, args.schoolId)
    await tenantsClient.updateOrganization(ctx, user._id, args.schoolId, {
      status: 'archived',
    })
    return null
  },
})

export const unarchiveSchool = mutation({
  args: { schoolId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireSchoolMember(ctx, user._id, args.schoolId)
    await tenantsClient.updateOrganization(ctx, user._id, args.schoolId, {
      status: 'active',
    })
    return null
  },
})

export const deleteSchool = mutation({
  args: { schoolId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireSchoolMember(ctx, user._id, args.schoolId)
    await tenantsClient.deleteOrganization(ctx, user._id, args.schoolId)
    return null
  },
})

const schoolMemberValidator = v.object({
  userId: v.string(),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  role: schoolOrgRoleValidator,
  status: v.optional(v.union(v.literal('active'), v.literal('suspended'))),
})

export const listSchoolMembers = query({
  args: { schoolId: v.string() },
  returns: v.array(schoolMemberValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireSchoolMember(ctx, user._id, args.schoolId)
    await tenantsClient.requireOperation(
      ctx,
      user._id,
      'listMembers',
      { type: 'organization', id: args.schoolId },
    )

    const members = await tenantsClient.listMembers(ctx, args.schoolId, {
      status: 'all',
      sortBy: 'role',
      sortOrder: 'asc',
    })
    const list = Array.isArray(members) ? members : members.page

    const result: Array<{
      userId: string
      name?: string
      email?: string
      role: SchoolOrgRole
      status?: 'active' | 'suspended'
    }> = []

    for (const member of list) {
      const role = isSchoolOrgRole(member.role) ? member.role : 'member'
      const userDoc = await ctx.db.get(member.userId as Id<'users'>)
      result.push({
        userId: member.userId,
        name: userDoc?.name,
        email: userDoc?.email,
        role,
        status: member.status,
      })
    }
    return result
  },
})

/**
 * Bring solo classes into a school. Caller must hold class:manage on each
 * class; classes must currently be solo (no organizationId).
 */
export const assignClassesToSchool = mutation({
  args: {
    schoolId: v.string(),
    classIds: v.array(v.id('classes')),
    teamId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireSchoolMember(ctx, user._id, args.schoolId)

    const org = await tenantsClient.getOrganization(ctx, args.schoolId)
    if (!org) throw new Error('School not found')
    if (org.status === 'archived' || org.status === 'suspended') {
      throw new Error('School is not active')
    }

    if (args.teamId) {
      const team = await tenantsClient.getTeam(ctx, args.teamId)
      if (!team || team.organizationId !== args.schoolId) {
        throw new Error('Team does not belong to this school')
      }
    }

    for (const classId of args.classIds) {
      await requireClassPermission(ctx, user._id, classId, 'class:manage')
      const classDoc = await ctx.db.get(classId)
      if (!classDoc) throw new Error('Class not found')
      if (classDoc.organizationId !== undefined) {
        throw new Error('Class already belongs to a school')
      }
      await ctx.db.patch(classId, {
        organizationId: args.schoolId,
        teamId: args.teamId,
        updatedTime: Date.now(),
      })
    }
    return null
  },
})

const schoolJoinCodesPublic = v.object({
  principalCode: v.string(),
  teacherCode: v.string(),
  adminCode: v.string(),
})

export const getSchoolJoinCodes = query({
  args: { schoolId: v.string() },
  returns: v.union(schoolJoinCodesPublic, v.null()),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireSchoolManageMembers(ctx, user._id, args.schoolId)
    const row = await ctx.db
      .query('schoolJoinCodes')
      .withIndex('by_organizationId', (q) =>
        q.eq('organizationId', args.schoolId),
      )
      .unique()
    if (!row) return null
    return {
      principalCode: row.principalCode,
      teacherCode: row.teacherCode,
      adminCode: row.adminCode,
    }
  },
})

/** Create join codes for schools created before codes existed. */
export const ensureSchoolJoinCodes = mutation({
  args: { schoolId: v.string() },
  returns: schoolJoinCodesPublic,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireSchoolManageMembers(ctx, user._id, args.schoolId)
    const row = await getOrCreateSchoolJoinCodes(ctx, args.schoolId)
    return {
      principalCode: row.principalCode,
      teacherCode: row.teacherCode,
      adminCode: row.adminCode,
    }
  },
})

export const regenerateSchoolJoinCode = mutation({
  args: {
    schoolId: v.string(),
    codeType: schoolJoinCodeTypeValidator,
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireSchoolManageMembers(ctx, user._id, args.schoolId)
    const row = await getOrCreateSchoolJoinCodes(ctx, args.schoolId)
    const newCode = await generateUniqueJoinCode(ctx, [
      row.principalCode,
      row.teacherCode,
      row.adminCode,
    ])
    const field =
      args.codeType === 'principal'
        ? 'principalCode'
        : args.codeType === 'teacher'
          ? 'teacherCode'
          : 'adminCode'
    await ctx.db.patch(row._id, { [field]: newCode })
    return newCode
  },
})

export const redeemSchoolJoinCode = mutation({
  args: { code: v.string() },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      schoolId: v.string(),
      role: schoolOrgRoleValidator,
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
      return {
        ok: false as const,
        error: 'Too many attempts. Please try again later.',
      }
    }
    const global = await rateLimiter.limit(ctx, 'joinCodeGlobal')
    if (!global.ok) {
      return {
        ok: false as const,
        error: 'Too many attempts. Please try again later.',
      }
    }
    return await tryRedeemSchoolJoinCode(ctx, user, args.code)
  },
})

const schoolClassListItem = v.object({
  _id: v.id('classes'),
  _creationTime: v.number(),
  name: v.string(),
  description: v.optional(v.string()),
  icon: v.optional(v.string()),
  year: v.number(),
  updatedTime: v.optional(v.number()),
  archivedTime: v.optional(v.number()),
  organizationId: v.optional(v.string()),
  teamId: v.optional(v.string()),
})

export const listSchoolClasses = query({
  args: {
    schoolId: v.string(),
    includeArchived: v.optional(v.boolean()),
  },
  returns: v.array(schoolClassListItem),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireSchoolMember(ctx, user._id, args.schoolId)
    const includeArchived = args.includeArchived === true
    const docs = await ctx.db
      .query('classes')
      .withIndex('by_organizationId', (q) =>
        q.eq('organizationId', args.schoolId),
      )
      .take(500)
    return docs
      .filter((doc) =>
        includeArchived ? true : doc.archivedTime === undefined,
      )
      .map((doc) => ({
        _id: doc._id,
        _creationTime: doc._creationTime,
        name: doc.name,
        description: doc.description,
        icon: doc.icon,
        year: doc.year,
        updatedTime: doc.updatedTime,
        archivedTime: doc.archivedTime,
        organizationId: doc.organizationId,
        teamId: doc.teamId,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  },
})

export const assignClassToTeam = mutation({
  args: {
    classId: v.id('classes'),
    teamId: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const classDoc = await ctx.db.get(args.classId)
    if (!classDoc?.organizationId) {
      throw new Error('Class is not part of a school')
    }
    await requireSchoolManageMembers(
      ctx,
      user._id,
      classDoc.organizationId,
    )

    if (args.teamId !== null) {
      const team = await tenantsClient.getTeam(ctx, args.teamId)
      if (!team || team.organizationId !== classDoc.organizationId) {
        throw new Error('Team does not belong to this school')
      }
      await ctx.db.patch(args.classId, {
        teamId: args.teamId,
        updatedTime: Date.now(),
      })
    } else {
      await ctx.db.patch(args.classId, {
        teamId: undefined,
        updatedTime: Date.now(),
      })
    }
    return null
  },
})

const classStaffRoleValidator = v.union(
  v.literal('classTeacher'),
  v.literal('assistantTeacher'),
)

export const assignClassStaff = mutation({
  args: {
    classId: v.id('classes'),
    userId: v.id('users'),
    role: classStaffRoleValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx)
    const classDoc = await ctx.db.get(args.classId)
    if (!classDoc) throw new Error('Class not found')
    if (classDoc.archivedTime !== undefined) {
      throw new Error('Class is archived')
    }
    if (!classDoc.organizationId) {
      throw new Error('Class is not part of a school')
    }

    const canManageClass = await hasClassPermission(
      ctx,
      caller._id,
      args.classId,
      'class:manage',
    )
    if (!canManageClass) {
      await requireSchoolManageMembers(
        ctx,
        caller._id,
        classDoc.organizationId,
      )
    }

    const schoolMember = await tenantsClient.getMember(
      ctx,
      classDoc.organizationId,
      args.userId,
    )
    if (!schoolMember || schoolMember.status === 'suspended') {
      throw new Error('User is not an active member of this school')
    }

    const scope = classScope(args.classId)
    const already = await authz.hasRole(ctx, args.userId, args.role, scope)
    if (!already) {
      await authz.assignRole(ctx, args.userId, args.role, scope)
    }
    return null
  },
})

export const removeClassStaff = mutation({
  args: {
    classId: v.id('classes'),
    userId: v.id('users'),
    role: classStaffRoleValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx)
    const classDoc = await ctx.db.get(args.classId)
    if (!classDoc?.organizationId) {
      throw new Error('Class is not part of a school')
    }

    const canManageClass = await hasClassPermission(
      ctx,
      caller._id,
      args.classId,
      'class:manage',
    )
    if (!canManageClass) {
      await requireSchoolManageMembers(
        ctx,
        caller._id,
        classDoc.organizationId,
      )
    }

    const scope = classScope(args.classId)
    await authz.revokeRole(ctx, args.userId, args.role, scope, caller._id)
    return null
  },
})

const classStaffMemberValidator = v.object({
  userId: v.id('users'),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  role: classStaffRoleValidator,
})

export const listClassStaff = query({
  args: { classId: v.id('classes') },
  returns: v.array(classStaffMemberValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const classDoc = await ctx.db.get(args.classId)
    if (!classDoc?.organizationId) return []
    await requireSchoolMember(ctx, user._id, classDoc.organizationId)

    const scope = classScope(args.classId)
    const [teachers, assistants] = await Promise.all([
      ctx.runQuery(components.authz.queries.getUsersWithRole, {
        tenantId: 'classclarus',
        role: 'classTeacher',
        scope,
      }),
      ctx.runQuery(components.authz.queries.getUsersWithRole, {
        tenantId: 'classclarus',
        role: 'assistantTeacher',
        scope,
      }),
    ])

    const teacherIds = new Set(teachers.map((entry) => entry.userId))
    const result: Array<{
      userId: Id<'users'>
      name?: string
      email?: string
      role: 'classTeacher' | 'assistantTeacher'
    }> = []

    for (const entry of teachers) {
      const doc = await ctx.db.get(entry.userId as Id<'users'>)
      result.push({
        userId: entry.userId as Id<'users'>,
        name: doc?.name,
        email: doc?.email,
        role: 'classTeacher',
      })
    }
    for (const entry of assistants) {
      if (teacherIds.has(entry.userId)) continue
      const doc = await ctx.db.get(entry.userId as Id<'users'>)
      result.push({
        userId: entry.userId as Id<'users'>,
        name: doc?.name,
        email: doc?.email,
        role: 'assistantTeacher',
      })
    }
    return result
  },
})
