import { requireUser } from '#/lib/auth'
import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireClassPermission } from './lib/classAuth'
import { formatClassStudentName } from './lib/studentNames'

const MAX_CLASS_STUDENTS = 500
const MAX_GROUPS_PER_CLASS = 100
const MAX_TEAMS_PER_GROUP = 50

const iconIdValidator = v.string()

function assertIconId(icon: string | undefined): void {
  if (icon === undefined) return
  if (!/^(fas|far):[a-z0-9-]+$/.test(icon)) {
    throw new Error('Invalid icon id')
  }
}

const studentValidator = v.object({
  orgStudentId: v.id('orgStudents'),
  displayName: v.string(),
  rosterNumber: v.number(),
})

const teamValidator = v.object({
  _id: v.id('classTeams'),
  name: v.string(),
  description: v.optional(v.string()),
  icon: v.optional(v.string()),
  sortOrder: v.optional(v.number()),
  students: v.array(studentValidator),
})

const groupValidator = v.object({
  _id: v.id('classGroups'),
  name: v.string(),
  description: v.optional(v.string()),
  icon: v.optional(v.string()),
  sortOrder: v.optional(v.number()),
  studentsWithoutTeam: v.array(studentValidator),
  teams: v.array(teamValidator),
})

const boardValidator = v.object({
  className: v.string(),
  year: v.number(),
  ungrouped: v.array(studentValidator),
  groups: v.array(groupValidator),
})

type BoardStudent = {
  orgStudentId: Id<'orgStudents'>
  displayName: string
  rosterNumber: number
}

async function loadActiveRoster(
  ctx: QueryCtx | MutationCtx,
  classId: Id<'classes'>,
): Promise<{
  classDoc: Doc<'classes'>
  studentsById: Map<Id<'orgStudents'>, BoardStudent>
}> {
  const classDoc = await ctx.db.get('classes', classId)
  if (!classDoc) {
    throw new Error('Class not found')
  }

  const enrollments = await ctx.db
    .query('classEnrollments')
    .withIndex('by_classId', (index) => index.eq('classId', classId))
    .take(MAX_CLASS_STUDENTS + 1)
  if (enrollments.length > MAX_CLASS_STUDENTS) {
    throw new Error('Class is too large for groups board')
  }

  const studentsById = new Map<Id<'orgStudents'>, BoardStudent>()
  for (const enrollment of enrollments) {
    if (enrollment.status !== 'active') continue
    const orgStudent = await ctx.db.get('orgStudents', enrollment.orgStudentId)
    if (!orgStudent) continue
    studentsById.set(orgStudent._id, {
      orgStudentId: orgStudent._id,
      displayName: formatClassStudentName(enrollment, orgStudent),
      rosterNumber: enrollment.rosterNumber ?? Number.MAX_SAFE_INTEGER,
    })
  }

  return { classDoc, studentsById }
}

async function requireActiveEnrollment(
  ctx: MutationCtx,
  classId: Id<'classes'>,
  orgStudentId: Id<'orgStudents'>,
): Promise<void> {
  const enrollment = await ctx.db
    .query('classEnrollments')
    .withIndex('by_classId_and_orgStudentId', (index) =>
      index.eq('classId', classId).eq('orgStudentId', orgStudentId),
    )
    .unique()
  if (!enrollment || enrollment.status !== 'active') {
    throw new Error('Student is not actively enrolled in this class')
  }
}

function sortByOrderThenName<
  T extends { sortOrder?: number; name: string },
>(items: Array<T>): Array<T> {
  return [...items].sort((left, right) => {
    const leftOrder = left.sortOrder ?? Number.MAX_SAFE_INTEGER
    const rightOrder = right.sortOrder ?? Number.MAX_SAFE_INTEGER
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    return left.name.localeCompare(right.name)
  })
}

function sortStudents(students: Array<BoardStudent>): Array<BoardStudent> {
  return [...students].sort((left, right) => {
    if (left.rosterNumber !== right.rosterNumber) {
      return left.rosterNumber - right.rosterNumber
    }
    return left.displayName.localeCompare(right.displayName)
  })
}

export const listGroupsBoard = query({
  args: {
    classId: v.id('classes'),
  },
  returns: boardValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireClassPermission(
      ctx,
      user._id,
      args.classId,
      'class:manageMembers',
    )

    const { classDoc, studentsById } = await loadActiveRoster(ctx, args.classId)

    const groups = await ctx.db
      .query('classGroups')
      .withIndex('by_classId', (index) => index.eq('classId', args.classId))
      .take(MAX_GROUPS_PER_CLASS)

    const teams = await ctx.db
      .query('classTeams')
      .withIndex('by_classId', (index) => index.eq('classId', args.classId))
      .take(MAX_GROUPS_PER_CLASS * MAX_TEAMS_PER_GROUP)

    const memberships = await ctx.db
      .query('classGroupMemberships')
      .withIndex('by_classId', (index) => index.eq('classId', args.classId))
      .take(MAX_CLASS_STUDENTS)

    const assignedIds = new Set<Id<'orgStudents'>>()
    const studentsByGroup = new Map<
      Id<'classGroups'>,
      { withoutTeam: Array<BoardStudent>; byTeam: Map<Id<'classTeams'>, Array<BoardStudent>> }
    >()

    for (const group of groups) {
      studentsByGroup.set(group._id, {
        withoutTeam: [],
        byTeam: new Map(),
      })
    }
    for (const team of teams) {
      const bucket = studentsByGroup.get(team.groupId)
      if (bucket) {
        bucket.byTeam.set(team._id, [])
      }
    }

    for (const membership of memberships) {
      const student = studentsById.get(membership.orgStudentId)
      if (!student) continue
      assignedIds.add(membership.orgStudentId)
      const bucket = studentsByGroup.get(membership.groupId)
      if (!bucket) continue
      if (membership.teamId) {
        const teamStudents = bucket.byTeam.get(membership.teamId)
        if (teamStudents) {
          teamStudents.push(student)
        } else {
          bucket.withoutTeam.push(student)
        }
      } else {
        bucket.withoutTeam.push(student)
      }
    }

    const ungrouped = sortStudents(
      [...studentsById.values()].filter(
        (student) => !assignedIds.has(student.orgStudentId),
      ),
    )

    const boardGroups = sortByOrderThenName(groups).map((group) => {
      const bucket = studentsByGroup.get(group._id)!
      const groupTeams = sortByOrderThenName(
        teams.filter((team) => team.groupId === group._id),
      ).map((team) => ({
        _id: team._id,
        name: team.name,
        description: team.description,
        icon: team.icon,
        sortOrder: team.sortOrder,
        students: sortStudents(bucket.byTeam.get(team._id) ?? []),
      }))

      return {
        _id: group._id,
        name: group.name,
        description: group.description,
        icon: group.icon,
        sortOrder: group.sortOrder,
        studentsWithoutTeam: sortStudents(bucket.withoutTeam),
        teams: groupTeams,
      }
    })

    return {
      className: classDoc.name,
      year: classDoc.year,
      ungrouped,
      groups: boardGroups,
    }
  },
})

export const createGroup = mutation({
  args: {
    classId: v.id('classes'),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(iconIdValidator),
  },
  returns: v.id('classGroups'),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireClassPermission(
      ctx,
      user._id,
      args.classId,
      'class:manageMembers',
    )

    const classDoc = await ctx.db.get('classes', args.classId)
    if (!classDoc) throw new Error('Class not found')

    const name = args.name.trim()
    if (!name) throw new Error('Group name is required')
    assertIconId(args.icon)

    const existing = await ctx.db
      .query('classGroups')
      .withIndex('by_classId', (index) => index.eq('classId', args.classId))
      .take(MAX_GROUPS_PER_CLASS + 1)
    if (existing.length >= MAX_GROUPS_PER_CLASS) {
      throw new Error('Too many groups in this class')
    }

    const sortOrder =
      existing.reduce(
        (max, group) => Math.max(max, group.sortOrder ?? 0),
        0,
      ) + 1

    return await ctx.db.insert('classGroups', {
      classId: args.classId,
      name,
      description: args.description?.trim() || undefined,
      icon: args.icon,
      sortOrder,
    })
  },
})

export const updateGroup = mutation({
  args: {
    groupId: v.id('classGroups'),
    name: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    icon: v.optional(v.union(iconIdValidator, v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const group = await ctx.db.get('classGroups', args.groupId)
    if (!group) throw new Error('Group not found')

    await requireClassPermission(
      ctx,
      user._id,
      group.classId,
      'class:manageMembers',
    )

    const patch: {
      name?: string
      description?: string | undefined
      icon?: string | undefined
    } = {}

    if (args.name !== undefined) {
      const name = args.name.trim()
      if (!name) throw new Error('Group name is required')
      patch.name = name
    }
    if (args.description !== undefined) {
      patch.description =
        args.description === null ? undefined : args.description.trim() || undefined
    }
    if (args.icon !== undefined) {
      if (args.icon === null) {
        patch.icon = undefined
      } else {
        assertIconId(args.icon)
        patch.icon = args.icon
      }
    }

    await ctx.db.patch('classGroups', args.groupId, patch)
    return null
  },
})

export const deleteGroup = mutation({
  args: {
    groupId: v.id('classGroups'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const group = await ctx.db.get('classGroups', args.groupId)
    if (!group) throw new Error('Group not found')

    await requireClassPermission(
      ctx,
      user._id,
      group.classId,
      'class:manageMembers',
    )

    const teams = await ctx.db
      .query('classTeams')
      .withIndex('by_groupId', (index) => index.eq('groupId', args.groupId))
      .take(MAX_TEAMS_PER_GROUP)
    for (const team of teams) {
      await ctx.db.delete('classTeams', team._id)
    }

    const memberships = await ctx.db
      .query('classGroupMemberships')
      .withIndex('by_groupId', (index) => index.eq('groupId', args.groupId))
      .take(MAX_CLASS_STUDENTS)
    for (const membership of memberships) {
      await ctx.db.delete('classGroupMemberships', membership._id)
    }

    await ctx.db.delete('classGroups', args.groupId)
    return null
  },
})

export const createTeam = mutation({
  args: {
    groupId: v.id('classGroups'),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(iconIdValidator),
  },
  returns: v.id('classTeams'),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const group = await ctx.db.get('classGroups', args.groupId)
    if (!group) throw new Error('Group not found')

    await requireClassPermission(
      ctx,
      user._id,
      group.classId,
      'class:manageMembers',
    )

    const name = args.name.trim()
    if (!name) throw new Error('Team name is required')
    assertIconId(args.icon)

    const existing = await ctx.db
      .query('classTeams')
      .withIndex('by_groupId', (index) => index.eq('groupId', args.groupId))
      .take(MAX_TEAMS_PER_GROUP + 1)
    if (existing.length >= MAX_TEAMS_PER_GROUP) {
      throw new Error('Too many teams in this group')
    }

    const sortOrder =
      existing.reduce((max, team) => Math.max(max, team.sortOrder ?? 0), 0) + 1

    return await ctx.db.insert('classTeams', {
      classId: group.classId,
      groupId: args.groupId,
      name,
      description: args.description?.trim() || undefined,
      icon: args.icon,
      sortOrder,
    })
  },
})

export const updateTeam = mutation({
  args: {
    teamId: v.id('classTeams'),
    name: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    icon: v.optional(v.union(iconIdValidator, v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const team = await ctx.db.get('classTeams', args.teamId)
    if (!team) throw new Error('Team not found')

    await requireClassPermission(
      ctx,
      user._id,
      team.classId,
      'class:manageMembers',
    )

    const patch: {
      name?: string
      description?: string | undefined
      icon?: string | undefined
    } = {}

    if (args.name !== undefined) {
      const name = args.name.trim()
      if (!name) throw new Error('Team name is required')
      patch.name = name
    }
    if (args.description !== undefined) {
      patch.description =
        args.description === null ? undefined : args.description.trim() || undefined
    }
    if (args.icon !== undefined) {
      if (args.icon === null) {
        patch.icon = undefined
      } else {
        assertIconId(args.icon)
        patch.icon = args.icon
      }
    }

    await ctx.db.patch('classTeams', args.teamId, patch)
    return null
  },
})

export const deleteTeam = mutation({
  args: {
    teamId: v.id('classTeams'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const team = await ctx.db.get('classTeams', args.teamId)
    if (!team) throw new Error('Team not found')

    await requireClassPermission(
      ctx,
      user._id,
      team.classId,
      'class:manageMembers',
    )

    const memberships = await ctx.db
      .query('classGroupMemberships')
      .withIndex('by_teamId', (index) => index.eq('teamId', args.teamId))
      .take(MAX_CLASS_STUDENTS)
    for (const membership of memberships) {
      await ctx.db.patch('classGroupMemberships', membership._id, {
        teamId: undefined,
      })
    }

    await ctx.db.delete('classTeams', args.teamId)
    return null
  },
})

export const assignStudent = mutation({
  args: {
    classId: v.id('classes'),
    orgStudentId: v.id('orgStudents'),
    groupId: v.union(v.id('classGroups'), v.null()),
    teamId: v.union(v.id('classTeams'), v.null()),
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

    await requireActiveEnrollment(ctx, args.classId, args.orgStudentId)

    const existing = await ctx.db
      .query('classGroupMemberships')
      .withIndex('by_classId_and_orgStudentId', (index) =>
        index.eq('classId', args.classId).eq('orgStudentId', args.orgStudentId),
      )
      .unique()

    if (args.groupId === null) {
      if (args.teamId !== null) {
        throw new Error('Cannot assign a team without a group')
      }
      if (existing) {
        await ctx.db.delete('classGroupMemberships', existing._id)
      }
      return null
    }

    const group = await ctx.db.get('classGroups', args.groupId)
    if (!group || group.classId !== args.classId) {
      throw new Error('Group not found in this class')
    }

    let teamId: Id<'classTeams'> | undefined
    if (args.teamId !== null) {
      const team = await ctx.db.get('classTeams', args.teamId)
      if (!team || team.classId !== args.classId) {
        throw new Error('Team not found in this class')
      }
      if (team.groupId !== args.groupId) {
        throw new Error('Team does not belong to this group')
      }
      teamId = team._id
    }

    if (existing) {
      await ctx.db.patch('classGroupMemberships', existing._id, {
        groupId: args.groupId,
        teamId,
      })
    } else {
      await ctx.db.insert('classGroupMemberships', {
        classId: args.classId,
        orgStudentId: args.orgStudentId,
        groupId: args.groupId,
        teamId,
      })
    }

    return null
  },
})
