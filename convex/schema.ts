import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { authTables } from '@convex-dev/auth/server'

export default defineSchema({
  ...authTables,
  classes: defineTable({
    // Denormalized creator metadata. Authorization goes through authz roles,
    // never through this field.
    userId: v.id('users'),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    year: v.number(),
    // createdAt: v.number(), // Convex automatically creates _creationTime, which is UNIX timestamp in milliseconds.
    updatedTime: v.optional(v.number()),
    archivedTime: v.optional(v.number()), // undefined = active, number = archived
    studentCode: v.string(),
    teacherCode: v.string(),
    assistantTeacherCode: v.string(),
    publicDisplayPin: v.optional(v.string()),
    organizationId: v.optional(v.string()), // undefined = solo class. Set in Phase 2 (tenants org/team ids).
    teamId: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_studentCode', ['studentCode'])
    .index('by_teacherCode', ['teacherCode'])
    .index('by_assistantTeacherCode', ['assistantTeacherCode']),
  orgStudents: defineTable({
    organizationId: v.optional(v.string()),
    displayName: v.string(),
    userId: v.optional(v.id('users')),
    externalId: v.optional(v.string()),
    guardianCode: v.string(),
  })
    .index('by_organizationId', ['organizationId'])
    .index('by_userId', ['userId'])
    .index('by_guardianCode', ['guardianCode']),
  classEnrollments: defineTable({
    organizationId: v.optional(v.string()),
    classId: v.id('classes'),
    orgStudentId: v.id('orgStudents'),
    status: v.union(v.literal('active'), v.literal('withdrawn')),
  })
    .index('by_classId', ['classId'])
    .index('by_orgStudentId', ['orgStudentId'])
    .index('by_classId_and_orgStudentId', ['classId', 'orgStudentId']),
  guardianLinks: defineTable({
    organizationId: v.optional(v.string()),
    guardianUserId: v.id('users'),
    orgStudentId: v.id('orgStudents'),
    linkedByUserId: v.id('users'),
    linkedAt: v.number(),
  })
    .index('by_guardianUserId', ['guardianUserId'])
    .index('by_guardianUserId_and_organizationId', [
      'guardianUserId',
      'organizationId',
    ])
    .index('by_orgStudentId', ['orgStudentId'])
    .index('by_guardianUserId_and_orgStudentId', [
      'guardianUserId',
      'orgStudentId',
    ]),
})
