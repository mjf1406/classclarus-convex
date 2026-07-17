// convex/lib/classAuth.ts
// Plain TypeScript helpers shared by class-scoped functions so mutations and
// queries don't repeat scope objects and permission strings.
import { authz } from '../authz'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'

/**
 * Closed union of class permission strings. Typos fail at compile time.
 */
export type ClassPermission =
  | 'class:read'
  | 'class:manage'
  | 'class:manageMembers'
  | 'class:grade'
  | 'class:submit'
  | 'class:viewOwnGrades'
  | 'class:viewChildGrades'

/**
 * Class roster roles ordered by precedence (highest first). Roles are
 * additive, so a user may hold several — display logic picks the highest.
 */
export const CLASS_ROLES_BY_PRECEDENCE = [
  'creator',
  'classTeacher',
  'assistantTeacher',
  'student',
] as const

export type ClassRole = (typeof CLASS_ROLES_BY_PRECEDENCE)[number]

export function highestClassRole(roles: Iterable<string>): ClassRole | null {
  const held = new Set(roles)
  for (const role of CLASS_ROLES_BY_PRECEDENCE) {
    if (held.has(role)) return role
  }
  return null
}

export function classScope(classId: Id<'classes'>): {
  type: 'class'
  id: string
} {
  return { type: 'class', id: classId }
}

/**
 * The user's highest role in the class, or null when they hold none.
 */
export async function getMyClassRole(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  classId: Id<'classes'>,
): Promise<ClassRole | null> {
  const entries = await authz.getUserRoles(ctx, userId, classScope(classId))
  return highestClassRole(entries.map((entry) => entry.role))
}

/**
 * Throws (ConvexError FORBIDDEN) unless the user holds the permission scoped
 * to the class. Works in queries and mutations.
 */
export async function requireClassPermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  classId: Id<'classes'>,
  permission: ClassPermission,
): Promise<void> {
  await authz.require(ctx, userId, permission, classScope(classId))
}

/**
 * Non-throwing variant for "null instead of error" reads (existence hiding).
 */
export async function hasClassPermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  classId: Id<'classes'>,
  permission: ClassPermission,
): Promise<boolean> {
  return await authz.can(ctx, userId, permission, classScope(classId))
}

/**
 * Assigns the `creator` class role. Mutation context only.
 */
export async function assignClassCreator(
  ctx: MutationCtx,
  userId: Id<'users'>,
  classId: Id<'classes'>,
): Promise<void> {
  await authz.assignRole(ctx, userId, 'creator', classScope(classId))
}
