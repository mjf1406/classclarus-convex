import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { hasClassPermission } from './classAuth'
import type { ClassPermission } from './classAuth'
import { hasGuardianAccess, requireGuardianAccess } from './guardianAuth'

type ContentCtx = QueryCtx | MutationCtx

/**
 * Audience check for per-student content (grades, submissions, etc.).
 *
 * Never rely on class:viewOwnGrades / class:read alone — students hold those
 * class-wide. Always pair with ownership or guardian access.
 *
 * class:viewChildGrades must NEVER be granted as a class-scoped role; guardians
 * use requireGuardianAccess (relation + active enrollment) instead.
 */
export async function canAccessStudentContent(
  ctx: ContentCtx,
  callerId: Id<'users'>,
  classId: Id<'classes'>,
  orgStudent: Doc<'orgStudents'>,
  staffPermission: ClassPermission = 'class:grade',
): Promise<boolean> {
  if (await hasClassPermission(ctx, callerId, classId, staffPermission)) {
    return true
  }

  if (orgStudent.userId !== undefined && orgStudent.userId === callerId) {
    return await hasClassPermission(
      ctx,
      callerId,
      classId,
      'class:viewOwnGrades',
    )
  }

  return await hasGuardianAccess(ctx, callerId, orgStudent._id, classId)
}

export async function requireStudentContentAccess(
  ctx: ContentCtx,
  callerId: Id<'users'>,
  classId: Id<'classes'>,
  orgStudent: Doc<'orgStudents'>,
  staffPermission: ClassPermission = 'class:grade',
): Promise<void> {
  if (await hasClassPermission(ctx, callerId, classId, staffPermission)) {
    return
  }

  if (orgStudent.userId !== undefined && orgStudent.userId === callerId) {
    const canViewOwn = await hasClassPermission(
      ctx,
      callerId,
      classId,
      'class:viewOwnGrades',
    )
    if (canViewOwn) return
    throw new Error('Not authorized to access this student content')
  }

  await requireGuardianAccess(ctx, callerId, orgStudent._id, classId)
}

export async function requireStudentContentAccessById(
  ctx: ContentCtx,
  callerId: Id<'users'>,
  classId: Id<'classes'>,
  orgStudentId: Id<'orgStudents'>,
  staffPermission: ClassPermission = 'class:grade',
): Promise<Doc<'orgStudents'>> {
  const orgStudent = await ctx.db.get('orgStudents', orgStudentId)
  if (!orgStudent) {
    throw new Error('Student not found')
  }
  await requireStudentContentAccess(
    ctx,
    callerId,
    classId,
    orgStudent,
    staffPermission,
  )
  return orgStudent
}
