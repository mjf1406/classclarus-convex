// Operational actions for the authz role catalog. After editing roles in
// authz.ts and deploying, run `npx convex run authzOps:syncRoles` so existing
// classclarus assignments (including classTeacher) pick up the new permissions.
// Internal-only: not callable from clients.
import { internalAction } from './_generated/server'
import { v } from 'convex/values'
import { authz } from './authz'

/**
 * Re-materialize permissions for every user holding any role in the
 * classclarus tenant catalog (class roster roles + any global assignments).
 * Org partitions are synced separately via `tenants:syncRoles`.
 */
export const syncRoles = internalAction({
  args: {},
  returns: v.object({
    rolesProcessed: v.number(),
    usersProcessed: v.number(),
  }),
  handler: async (ctx) => {
    return await authz.syncRoles(ctx)
  },
})

/**
 * Per-role variant — e.g. `npx convex run authzOps:syncRole '{"role":"classTeacher"}'`.
 */
export const syncRole = internalAction({
  args: { role: v.string() },
  returns: v.object({
    usersProcessed: v.number(),
  }),
  handler: async (ctx, args) => {
    // Role names are validated inside authz.syncRole against the catalog.
    return await authz.syncRole(
      ctx,
      args.role as Parameters<typeof authz.syncRole>[1],
    )
  },
})
