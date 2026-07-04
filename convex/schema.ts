import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { authTables } from '@convex-dev/auth/server'

export default defineSchema({
  ...authTables,
  classes: defineTable({
    userId: v.id('users'),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    year: v.optional(v.number()),
    // createdAt: v.number(), // Convex automatically creates _creationTime, which is UNIX timestamp in milliseconds.
    updatedTime: v.optional(v.number()),
    archivedTime: v.optional(v.number()), // null = active, string = archived
    studentCode: v.string(),
    teacherCode: v.string(),
    guardianCode: v.string(),
    publicDisplayPin: v.optional(v.string()),
  }).index('by_user', ['userId']),
})
