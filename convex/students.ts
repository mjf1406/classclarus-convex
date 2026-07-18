import { requireUser } from '#/lib/auth'
import { v } from 'convex/values'

import { internalMutation, mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { requireClassPermission } from './lib/classAuth'
import { listGuardianLinksForStudent } from './lib/guardianLinks'
import {
  formatClassStudentName,
  genderValidator,
  legalFirstName,
  legalLastName,
  pronounsValidator,
  splitDisplayName,
} from './lib/studentNames'
import type { StudentGender, StudentPronouns } from './lib/studentNames'

const MAX_CLASS_STUDENTS = 500

const listedGuardianValidator = v.object({
  guardianUserId: v.id('users'),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  linkedAt: v.number(),
})

const rosterStudentValidator = v.object({
  enrollmentId: v.id('classEnrollments'),
  orgStudentId: v.id('orgStudents'),
  rosterNumber: v.number(),
  firstName: v.string(),
  lastName: v.string(),
  gender: v.optional(genderValidator),
  pronouns: v.optional(pronounsValidator),
  email: v.optional(v.string()),
  rosterFirstName: v.optional(v.string()),
  rosterLastName: v.optional(v.string()),
  displayName: v.string(),
  guardianCode: v.string(),
  guardians: v.array(listedGuardianValidator),
})

async function requireActiveEnrollment(
  ctx: MutationCtx | QueryCtx,
  classId: Id<'classes'>,
  enrollmentId: Id<'classEnrollments'>,
) {
  const enrollment = await ctx.db.get('classEnrollments', enrollmentId)
  if (
    !enrollment ||
    enrollment.classId !== classId ||
    enrollment.status !== 'active'
  ) {
    throw new Error('Enrollment not found in this class')
  }
  return enrollment
}

export const listClassRoster = query({
  args: {
    classId: v.id('classes'),
  },
  returns: v.object({
    className: v.string(),
    year: v.number(),
    students: v.array(rosterStudentValidator),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireClassPermission(
      ctx,
      user._id,
      args.classId,
      'class:manageMembers',
    )

    const classDoc = await ctx.db.get('classes', args.classId)
    if (!classDoc) {
      throw new Error('Class not found')
    }

    const enrollments = await ctx.db
      .query('classEnrollments')
      .withIndex('by_classId', (index) => index.eq('classId', args.classId))
      .take(MAX_CLASS_STUDENTS + 1)
    if (enrollments.length > MAX_CLASS_STUDENTS) {
      throw new Error('Class is too large for roster list')
    }

    const students: Array<{
      enrollmentId: Id<'classEnrollments'>
      orgStudentId: Id<'orgStudents'>
      rosterNumber: number
      firstName: string
      lastName: string
      gender?: StudentGender
      pronouns?: StudentPronouns
      email?: string
      rosterFirstName?: string
      rosterLastName?: string
      displayName: string
      guardianCode: string
      guardians: Array<{
        guardianUserId: Id<'users'>
        name?: string
        email?: string
        linkedAt: number
      }>
    }> = []

    for (const enrollment of enrollments) {
      if (enrollment.status !== 'active') continue
      if (enrollment.organizationId !== classDoc.organizationId) continue

      const orgStudent = await ctx.db.get('orgStudents', enrollment.orgStudentId)
      if (!orgStudent) continue
      if (orgStudent.organizationId !== classDoc.organizationId) continue

      const links = await listGuardianLinksForStudent(
        ctx,
        orgStudent._id,
        orgStudent.organizationId,
      )
      const guardians = await Promise.all(
        links.map(async (link) => {
          const guardian = await ctx.db.get('users', link.guardianUserId)
          return {
            guardianUserId: link.guardianUserId,
            name: guardian?.name,
            email: guardian?.email,
            linkedAt: link.linkedAt,
          }
        }),
      )

      students.push({
        enrollmentId: enrollment._id,
        orgStudentId: orgStudent._id,
        rosterNumber: enrollment.rosterNumber ?? Number.MAX_SAFE_INTEGER,
        firstName: legalFirstName(orgStudent),
        lastName: legalLastName(orgStudent),
        gender: orgStudent.gender,
        pronouns: orgStudent.pronouns,
        email: orgStudent.email,
        rosterFirstName: enrollment.rosterFirstName,
        rosterLastName: enrollment.rosterLastName,
        displayName: formatClassStudentName(enrollment, orgStudent),
        guardianCode: orgStudent.guardianCode,
        guardians,
      })
    }

    students.sort((left, right) => {
      if (left.rosterNumber !== right.rosterNumber) {
        return left.rosterNumber - right.rosterNumber
      }
      return left.displayName.localeCompare(right.displayName)
    })

    return {
      className: classDoc.name,
      year: classDoc.year,
      students,
    }
  },
})

export const updateStudentProfile = mutation({
  args: {
    classId: v.id('classes'),
    orgStudentId: v.id('orgStudents'),
    gender: v.optional(genderValidator),
    pronouns: v.optional(pronounsValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireClassPermission(
      ctx,
      user._id,
      args.classId,
      'class:manageMembers',
    )

    const enrollment = await ctx.db
      .query('classEnrollments')
      .withIndex('by_classId_and_orgStudentId', (index) =>
        index
          .eq('classId', args.classId)
          .eq('orgStudentId', args.orgStudentId),
      )
      .unique()
    if (!enrollment || enrollment.status !== 'active') {
      throw new Error('Student is not actively enrolled in this class')
    }

    const orgStudent = await ctx.db.get('orgStudents', args.orgStudentId)
    if (!orgStudent) {
      throw new Error('Student not found')
    }

    await ctx.db.patch('orgStudents', args.orgStudentId, {
      ...(args.gender !== undefined ? { gender: args.gender } : {}),
      ...(args.pronouns !== undefined ? { pronouns: args.pronouns } : {}),
    })
    return null
  },
})

export const updateEnrollmentDisplay = mutation({
  args: {
    classId: v.id('classes'),
    enrollmentId: v.id('classEnrollments'),
    rosterFirstName: v.optional(v.string()),
    rosterLastName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireClassPermission(
      ctx,
      user._id,
      args.classId,
      'class:manageMembers',
    )

    const enrollment = await requireActiveEnrollment(
      ctx,
      args.classId,
      args.enrollmentId,
    )

    const rosterFirstName = args.rosterFirstName?.trim()
    const rosterLastName = args.rosterLastName?.trim()

    await ctx.db.replace('classEnrollments', enrollment._id, {
      organizationId: enrollment.organizationId,
      classId: enrollment.classId,
      orgStudentId: enrollment.orgStudentId,
      status: enrollment.status,
      rosterNumber: enrollment.rosterNumber,
      ...(rosterFirstName ? { rosterFirstName } : {}),
      ...(rosterLastName ? { rosterLastName } : {}),
    })
    return null
  },
})

export const reorderRoster = mutation({
  args: {
    classId: v.id('classes'),
    enrollmentIds: v.array(v.id('classEnrollments')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireClassPermission(
      ctx,
      user._id,
      args.classId,
      'class:manageMembers',
    )

    if (args.enrollmentIds.length > MAX_CLASS_STUDENTS) {
      throw new Error('Too many enrollments')
    }

    const enrollments = await ctx.db
      .query('classEnrollments')
      .withIndex('by_classId', (index) => index.eq('classId', args.classId))
      .take(MAX_CLASS_STUDENTS + 1)
    if (enrollments.length > MAX_CLASS_STUDENTS) {
      throw new Error('Class is too large to reorder')
    }

    const active = enrollments.filter((row) => row.status === 'active')
    const activeIds = new Set(active.map((row) => row._id))

    if (args.enrollmentIds.length !== active.length) {
      throw new Error('Enrollment list does not match class roster')
    }
    const seen = new Set<Id<'classEnrollments'>>()
    for (const enrollmentId of args.enrollmentIds) {
      if (!activeIds.has(enrollmentId) || seen.has(enrollmentId)) {
        throw new Error('Invalid enrollment order')
      }
      seen.add(enrollmentId)
    }

    for (let index = 0; index < args.enrollmentIds.length; index++) {
      const enrollmentId = args.enrollmentIds[index]
      if (!enrollmentId) continue
      await ctx.db.patch('classEnrollments', enrollmentId, {
        rosterNumber: index + 1,
      })
    }
    return null
  },
})

/**
 * One-shot: split legacy displayName into first/last and assign roster numbers.
 *   bunx convex run students:backfillRosterNames
 */
export const backfillRosterNames = internalMutation({
  args: {},
  returns: v.object({
    studentsScanned: v.number(),
    studentsUpdated: v.number(),
    enrollmentsUpdated: v.number(),
  }),
  handler: async (ctx) => {
    const orgStudents = await ctx.db.query('orgStudents').collect()
    let studentsUpdated = 0
    for (const student of orgStudents) {
      const needsNames =
        student.firstName === undefined || student.lastName === undefined
      const needsEmail = student.email === undefined && student.userId !== undefined
      if (!needsNames && !needsEmail) continue

      let firstName = student.firstName
      let lastName = student.lastName
      if (needsNames) {
        if (student.displayName) {
          const split = splitDisplayName(student.displayName)
          firstName = firstName ?? split.firstName
          lastName = lastName ?? split.lastName
        } else if (student.userId) {
          const linked = await ctx.db.get('users', student.userId)
          if (linked) {
            const split = splitDisplayName(
              linked.name?.trim() || linked.email?.trim() || 'Student',
            )
            firstName = firstName ?? split.firstName
            lastName = lastName ?? split.lastName
          }
        }
        firstName = firstName ?? ''
        lastName = lastName ?? 'Student'
      }

      let email = student.email
      if (email === undefined && student.userId) {
        const linked = await ctx.db.get('users', student.userId)
        email = linked?.email?.trim() || undefined
      }

      await ctx.db.patch('orgStudents', student._id, {
        ...(needsNames
          ? {
              firstName: firstName ?? '',
              lastName: lastName ?? 'Student',
            }
          : {}),
        ...(email !== undefined ? { email } : {}),
      })
      studentsUpdated++
    }

    const classes = await ctx.db.query('classes').collect()
    let enrollmentsUpdated = 0
    for (const classDoc of classes) {
      const enrollments = await ctx.db
        .query('classEnrollments')
        .withIndex('by_classId', (index) => index.eq('classId', classDoc._id))
        .take(MAX_CLASS_STUDENTS)

      const active = enrollments.filter((row) => row.status === 'active')
      const needsNumber = active.some((row) => row.rosterNumber === undefined)
      if (!needsNumber) continue

      const withNames = await Promise.all(
        active.map(async (enrollment) => {
          const orgStudent = await ctx.db.get(
            'orgStudents',
            enrollment.orgStudentId,
          )
          return {
            enrollment,
            sortKey: orgStudent
              ? formatClassStudentName(enrollment, orgStudent)
              : '',
          }
        }),
      )
      withNames.sort((left, right) =>
        left.sortKey.localeCompare(right.sortKey),
      )

      let rosterIndex = 0
      for (const { enrollment } of withNames) {
        rosterIndex += 1
        if (enrollment.rosterNumber === rosterIndex) continue
        await ctx.db.patch('classEnrollments', enrollment._id, {
          rosterNumber: rosterIndex,
        })
        enrollmentsUpdated++
      }
    }

    return {
      studentsScanned: orgStudents.length,
      studentsUpdated,
      enrollmentsUpdated,
    }
  },
})
