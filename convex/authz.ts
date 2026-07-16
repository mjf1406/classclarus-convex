// convex/authz.ts
import { Authz, definePermissions, defineRoles } from '@djpanda/convex-authz'
import { TENANTS_PERMISSIONS, TENANTS_ROLES } from '@djpanda/convex-tenants'
import { components } from './_generated/api'

// Step 1: Define permissions
const permissions = definePermissions(TENANTS_PERMISSIONS, {
  documents: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },
  settings: {
    view: true,
    manage: true,
  },
})

// Step 2: Define roles
const roles = defineRoles(permissions, TENANTS_ROLES, {
  admin: {
    documents: ['create', 'read', 'update', 'delete'],
    settings: ['view', 'manage'],
  },
  editor: {
    documents: ['create', 'read', 'update'],
    settings: ['view'],
  },
  viewer: {
    documents: ['read'],
  },
})

// Step 3: Create the authz client
export const authz = new Authz(components.authz, {
  permissions,
  roles,
  tenantId: 'classclarus',
})
