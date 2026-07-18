import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { authTables } from '@convex-dev/auth/server'
import { classLanguageValidator, languageValidator } from './lib/languages'

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
    // 'user' = each viewer uses personal language; concrete locale locks students.
    // Optional for legacy rows; missing coerces to 'user' in the public API.
    language: v.optional(classLanguageValidator),
  })
    .index('by_user', ['userId'])
    .index('by_studentCode', ['studentCode'])
    .index('by_teacherCode', ['teacherCode'])
    .index('by_assistantTeacherCode', ['assistantTeacherCode']),
  userPreferences: defineTable({
    userId: v.id('users'),
    language: languageValidator,
  }).index('by_userId', ['userId']),
  orgStudents: defineTable({
    organizationId: v.optional(v.string()),
    // Legacy single name; optional until backfillRosterNames runs, then unused.
    displayName: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    gender: v.optional(
      v.union(
        v.literal('male'),
        v.literal('female'),
        v.literal('nonBinary'),
        v.literal('transgender'),
        v.literal('agender'),
        v.literal('genderfluid'),
        v.literal('unspecified'),
      ),
    ),
    pronouns: v.optional(
      v.union(
        v.literal('sheHer'),
        v.literal('heHim'),
        v.literal('theyThem'),
        v.literal('itIts'),
        v.literal('perPers'),
        v.literal('zeHir'),
        v.literal('xeXem'),
        v.literal('nameOnly'),
        v.literal('unspecified'),
      ),
    ),
    email: v.optional(v.string()),
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
    // 1-based class-local seat order; optional until backfillRosterNames.
    rosterNumber: v.optional(v.number()),
    rosterFirstName: v.optional(v.string()),
    rosterLastName: v.optional(v.string()),
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
  // Classroom student groups (not tenants/org staff teams).
  classGroups: defineTable({
    classId: v.id('classes'),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  }).index('by_classId', ['classId']),
  classTeams: defineTable({
    classId: v.id('classes'),
    groupId: v.id('classGroups'),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  })
    .index('by_groupId', ['groupId'])
    .index('by_classId', ['classId']),
  classGroupMemberships: defineTable({
    classId: v.id('classes'),
    orgStudentId: v.id('orgStudents'),
    groupId: v.id('classGroups'),
    teamId: v.optional(v.id('classTeams')),
  })
    .index('by_classId', ['classId'])
    .index('by_classId_and_orgStudentId', ['classId', 'orgStudentId'])
    .index('by_groupId', ['groupId'])
    .index('by_teamId', ['teamId']),
})
