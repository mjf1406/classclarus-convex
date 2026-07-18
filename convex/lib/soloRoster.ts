import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { generateUniqueJoinCode } from './joinCodes'
import { revokeGuardiansAndRotateCode } from './guardianLinks'
import { namesFromUser } from './studentNames'

const MAX_SOLO_STUDENT_RECORDS = 200
const MAX_CLASS_STUDENTS = 500

export async function nextRosterNumber(
  ctx: MutationCtx,
  classId: Id<'classes'>,
): Promise<number> {
  const enrollments = await ctx.db
    .query('classEnrollments')
    .withIndex('by_classId', (index) => index.eq('classId', classId))
    .take(MAX_CLASS_STUDENTS)

  let max = 0
  for (const enrollment of enrollments) {
    if (
      enrollment.status === 'active' &&
      enrollment.rosterNumber !== undefined &&
      enrollment.rosterNumber > max
    ) {
      max = enrollment.rosterNumber
    }
  }
  return max + 1
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

  const names = namesFromUser(user)

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
      const rosterNumber =
        enrollment.rosterNumber ?? (await nextRosterNumber(ctx, classId))
      await ctx.db.patch('classEnrollments', enrollment._id, {
        status: 'active',
        rosterNumber,
      })
    }

    const patch: {
      firstName?: string
      lastName?: string
      email?: string
    } = {}
    if (student.firstName !== names.firstName) patch.firstName = names.firstName
    if (student.lastName !== names.lastName) patch.lastName = names.lastName
    if (names.email !== undefined && student.email !== names.email) {
      patch.email = names.email
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch('orgStudents', student._id, patch)
    }
    return student._id
  }

  const guardianCode = await generateUniqueJoinCode(ctx)
  const orgStudentId = await ctx.db.insert('orgStudents', {
    firstName: names.firstName,
    lastName: names.lastName,
    email: names.email,
    userId: user._id,
    guardianCode,
  })
  await ctx.db.insert('classEnrollments', {
    classId,
    orgStudentId,
    status: 'active',
    rosterNumber: await nextRosterNumber(ctx, classId),
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
