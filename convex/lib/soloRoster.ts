import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { generateUniqueJoinCode } from './joinCodes'
import { revokeGuardiansAndRotateCode } from './guardianLinks'

const MAX_SOLO_STUDENT_RECORDS = 200

function studentDisplayName(user: Doc<'users'>): string {
  return user.name ?? user.email ?? 'Student'
}

export async function ensureSoloStudentEnrollment(
  ctx: MutationCtx,
  user: Doc<'users'>,
  classId: Id<'classes'>,
): Promise<Id<'orgStudents'>> {
  const studentRecords = await ctx.db
    .query('orgStudents')
    .withIndex('by_userId', (index) => index.eq('userId', user._id))
    .take(MAX_SOLO_STUDENT_RECORDS)

  for (const student of studentRecords) {
    if (student.organizationId !== undefined) continue

    const enrollment = await ctx.db
      .query('classEnrollments')
      .withIndex('by_classId_and_orgStudentId', (index) =>
        index.eq('classId', classId).eq('orgStudentId', student._id),
      )
      .unique()
    if (!enrollment) continue

    if (enrollment.organizationId !== undefined) {
      throw new Error('Solo student enrollment scope mismatch')
    }
    if (enrollment.status === 'withdrawn') {
      await ctx.db.patch('classEnrollments', enrollment._id, {
        status: 'active',
      })
    }

    const displayName = studentDisplayName(user)
    if (student.displayName !== displayName) {
      await ctx.db.patch('orgStudents', student._id, { displayName })
    }
    return student._id
  }

  const guardianCode = await generateUniqueJoinCode(ctx)
  const orgStudentId = await ctx.db.insert('orgStudents', {
    displayName: studentDisplayName(user),
    userId: user._id,
    guardianCode,
  })
  await ctx.db.insert('classEnrollments', {
    classId,
    orgStudentId,
    status: 'active',
  })
  return orgStudentId
}

/**
 * Withdraw enrollment and revoke guardian access for this class's solo record.
 * Caller id is used for authz relation audit on unlink.
 */
export async function withdrawSoloStudentEnrollment(
  ctx: MutationCtx,
  userId: Id<'users'>,
  classId: Id<'classes'>,
  callerId: Id<'users'>,
): Promise<void> {
  const studentRecords = await ctx.db
    .query('orgStudents')
    .withIndex('by_userId', (index) => index.eq('userId', userId))
    .take(MAX_SOLO_STUDENT_RECORDS)

  for (const student of studentRecords) {
    if (student.organizationId !== undefined) continue

    const enrollment = await ctx.db
      .query('classEnrollments')
      .withIndex('by_classId_and_orgStudentId', (index) =>
        index.eq('classId', classId).eq('orgStudentId', student._id),
      )
      .unique()
    if (enrollment?.status === 'active') {
      await ctx.db.patch('classEnrollments', enrollment._id, {
        status: 'withdrawn',
      })
      await revokeGuardiansAndRotateCode(ctx, callerId, student)
    }
  }
}
