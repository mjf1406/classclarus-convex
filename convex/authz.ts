// convex/authz.ts
// Single source of truth for the permission catalog, role catalog, and the
// authz client. See plans/roles-and-authorization-implementation-guide.md §5/§7.3.
//
// Operational rule: after editing role definitions and deploying, run
// `npx convex run authzOps:syncRoles` (internal; classclarus / class roles) and
// `npx convex run tenants:syncRoles` (org partitions) so users who already
// hold a role get the new materialized permission set.
import { Authz, definePermissions, defineRoles } from '@djpanda/convex-authz'
import { TENANTS_PERMISSIONS, TENANTS_ROLES } from '@djpanda/convex-tenants'
import { components } from './_generated/api'

// Step 1: Permissions — tenants defaults merged with app resources.
const permissions = definePermissions(TENANTS_PERMISSIONS, {
  class: {
    read: true,
    manage: true, // edit settings, archive, delete, remove members
    manageMembers: true, // can add members via join codes
    grade: true,
    submit: true,
    viewOwnGrades: true,
    // Defined for the permission catalog / UI closed union only.
    // NEVER grant class:viewChildGrades on any class role — that would be
    // class-wide. Guardians use requireGuardianAccess / requireStudentContentAccess.
    viewChildGrades: true,
  },
  students: {
    create: true,
    list: true,
    enroll: true,
    unenroll: true,
    update: true,
  },
  guardians: {
    link: true,
    unlink: true,
    viewLinkedStudents: true,
  },
})

// Step 2: Roles — tenants defaults (owner/admin/member) merged with education
// org roles and class-scoped roster roles.
//
// Naming notes (guide §5): the class role is `classTeacher` (org role `teacher`
// already exists in the same catalog; UI label is "Teacher") and the top class
// role is `creator` (`owner` is taken by tenants). `classTeacher` has full
// class ops via `class:manage`; `creator` is the ownership marker.
const roles = defineRoles(permissions, TENANTS_ROLES, {
  // --- Org roles (school/district STAFF only; used from Phase 2) ---
  // Extend the tenants `owner` default with the education resources.
  owner: {
    students: ['create', 'list', 'enroll', 'unenroll', 'update'],
    guardians: ['link', 'unlink', 'viewLinkedStudents'],
  },
  principal: {
    organizations: ['read', 'update'],
    members: ['add', 'remove', 'updateRole', 'list'],
    teams: [
      'create',
      'update',
      'delete',
      'addMember',
      'removeMember',
      'list',
      'listMembers',
    ],
    invitations: ['create', 'cancel', 'resend', 'list'],
    students: ['create', 'list', 'enroll', 'unenroll', 'update'],
    guardians: ['link', 'unlink', 'viewLinkedStudents'],
  },
  teacher: {
    organizations: ['read'],
    students: ['create', 'list', 'enroll', 'unenroll', 'update'],
    guardians: ['link', 'unlink', 'viewLinkedStudents'],
  },

  // --- Class roles (roster; scoped to { type: "class", id }) ---
  student: {
    class: ['read', 'submit', 'viewOwnGrades'],
  },
  assistantTeacher: {
    inherits: 'student',
    class: ['grade'],
  },
  classTeacher: {
    inherits: 'assistantTeacher',
    // Full class ops (settings, archive/delete, roster, all join codes).
    // `creator` remains a distinct ownership marker above this role.
    class: ['manageMembers', 'manage'],
  },
  creator: {
    inherits: 'classTeacher',
    // Ownership / history marker; permissions come from classTeacher.
  },
})

// Step 3: The authz client. The "classclarus" tenant namespace holds solo-class
// role assignments; org-scoped calls in Phase 2 go through withTenant(orgId).
// No relationPermissions — guardian access uses an explicit two-step check
// (relation + active enrollment), see guide §4. Do not assign
// class:viewChildGrades to any role; use requireStudentContentAccess instead.
export const authz = new Authz(components.authz, {
  permissions,
  roles,
  tenantId: 'classclarus',
})
