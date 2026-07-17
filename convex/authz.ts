// convex/authz.ts
import { Authz, definePermissions, defineRoles } from '@djpanda/convex-authz'
import { TENANTS_PERMISSIONS, TENANTS_ROLES } from '@djpanda/convex-tenants'
import { components } from './_generated/api'

// Step 1: Define permissions
const permissions = definePermissions(
  TENANTS_PERMISSIONS, 
  {
    "org-settings": {
      read: true,
      update: true,
    },
    "class-settings": {
      read: true,
      update: true,
    },
    class: {
      create: true,
      read: true,
      update: true,
      delete: true,
      "manage-members": true,
      
    }
  }
)

// Step 2: Define roles
const roles = defineRoles(
  permissions, 
  TENANTS_ROLES,
  {
    admin: { // this is me, the website developer
      "org-settings": ['read', 'update'],
      "class-settings": ['read', 'update'],
      class: ['create', 'read', 'update', 'delete']
    },
    // Organization Roles
    "principal": {},
    "vice-principal": {},
    "administration": {},
    "teacher": {},
    // Class Roles
    "class-teacher": {},
    "class-owner": {
      class: ['create', 'read', 'update', 'delete'],
      "class-settings": ['read', 'update']
    },
    "class-assistant-teacher": {},
    "class-student": {},
    "guardian": {}
  }
)

// Step 3: Create the authz client
export const authz = new Authz(components.authz, {
  permissions,
  roles,
  tenantId: 'classclarus',
})
