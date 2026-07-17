import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { authz } from '../authz'

const GUARDIAN_RELATION = 'guardian_of'
const MAX_GUARDIAN_LINKS_FOR_CLASS_CHECK = 100

export function guardianAuthz(organizationId: string | undefined) {
  return organizationId ? authz.withTenant(organizationId) : authz
}

export function guardianSubject(userId: Id<'users'>): {
  type: 'user'
  id: string
} {
  return { type: 'user', id: userId }
}

export function guardianObject(orgStudentId: Id<'orgStudents'>): {
  type: 'orgStudent'
  id: string
} {
  return { type: 'orgStudent', id: orgStudentId }
}

export async function hasGuardianAccess(
  ctx: QueryCtx | MutationCtx,
  guardianUserId: Id<'users'>,
  orgStudentId: Id<'orgStudents'>,
  classId: Id<'classes'>,
): Promise<boolean> {
  const orgStudent = await ctx.db.get('orgStudents', orgStudentId)
  if (!orgStudent) {
    return false
  }

  const enrollment = await ctx.db
    .query('classEnrollments')
    .withIndex('by_classId_and_orgStudentId', (query) =>
      query.eq('classId', classId).eq('orgStudentId', orgStudentId),
    )
    .unique()
  if (
    !enrollment ||
    enrollment.status !== 'active' ||
    enrollment.organizationId !== orgStudent.organizationId
  ) {
    return false
  }

  return await guardianAuthz(orgStudent.organizationId).hasRelation(
    ctx,
    guardianSubject(guardianUserId),
    GUARDIAN_RELATION,
    guardianObject(orgStudentId),
  )
}

/**
 * True when the user is guardian_of any student with an active enrollment
 * in this class. Starts from the guardian's links (not the class roster).
 */
export async function hasGuardianAccessToClass(
  ctx: QueryCtx | MutationCtx,
  guardianUserId: Id<'users'>,
  classId: Id<'classes'>,
): Promise<boolean> {
  const links = await ctx.db
    .query('guardianLinks')
    .withIndex('by_guardianUserId', (query) =>
      query.eq('guardianUserId', guardianUserId),
    )
    .take(MAX_GUARDIAN_LINKS_FOR_CLASS_CHECK)

  for (const link of links) {
    if (
      await hasGuardianAccess(
        ctx,
        guardianUserId,
        link.orgStudentId,
        classId,
      )
    ) {
      return true
    }
  }
  return false
}

export async function requireGuardianAccess(
  ctx: QueryCtx | MutationCtx,
  guardianUserId: Id<'users'>,
  orgStudentId: Id<'orgStudents'>,
  classId: Id<'classes'>,
): Promise<void> {
  const allowed = await hasGuardianAccess(
    ctx,
    guardianUserId,
    orgStudentId,
    classId,
  )
  if (!allowed) {
    throw new Error('Guardian access denied')
  }
}

export { GUARDIAN_RELATION }
