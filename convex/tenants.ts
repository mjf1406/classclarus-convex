import { Tenants, makeTenantsAPI } from '@djpanda/convex-tenants'
import { components } from './_generated/api'
import { getAuthUserId } from '@convex-dev/auth/server'
import { authz } from './authz'

/** Shared Tenants client for school wrappers and account-home enrichment. */
export const tenantsClient = new Tenants(components.tenants, {
  authz,
  creatorRole: 'owner',
  roleHierarchy: {
    owner: 5,
    admin: 3,
    principal: 3,
    teacher: 1,
    member: 0,
  },
})

export const SCHOOL_ORG_ROLES = [
  'owner',
  'admin',
  'principal',
  'teacher',
  'member',
] as const

export type SchoolOrgRole = (typeof SCHOOL_ORG_ROLES)[number]

export const {
  // Organizations
  listOrganizations,
  getOrganization,
  getOrganizationBySlug,
  createOrganization,
  updateOrganization,
  transferOwnership,
  deleteOrganization,
  // Members
  listMembers,
  countMembers,
  getMember,
  getCurrentMember,
  addMember,
  bulkAddMembers,
  removeMember,
  bulkRemoveMembers,
  updateMemberRole,
  suspendMember,
  unsuspendMember,
  leaveOrganization,
  // Teams
  listTeams,
  listTeamsAsTree,
  countTeams,
  getTeam,
  listTeamMembers,
  isTeamMember,
  createTeam,
  updateTeam,
  deleteTeam,
  addTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
  // Invitations
  listInvitations,
  countInvitations,
  getInvitation,
  getPendingInvitations,
  inviteMember,
  bulkInviteMembers,
  acceptInvitation,
  resendInvitation,
  cancelInvitation,
  // Authorization
  checkPermission,
  getUserPermissions,
  getUserRoles,
  grantPermission,
  denyPermission,
  getAuditLog,
  // Re-materialize permissions after editing role definitions in authz.ts.
  syncRoles,
  syncRole,
} = makeTenantsAPI(components.tenants, {
  authz,
  creatorRole: 'owner',
  auth: async (ctx) => {
    return (await getAuthUserId(ctx)) ?? null
  },
  getUser: async (ctx, userId) => {
    const user = await ctx.db.get(userId)
    return user ? { name: user.name, email: user.email } : null
  },
  roleHierarchy: {
    owner: 5,
    admin: 3,
    principal: 3,
    teacher: 1,
    member: 0,
  },
  validRoles: SCHOOL_ORG_ROLES,
})
