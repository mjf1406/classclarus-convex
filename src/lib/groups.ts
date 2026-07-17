import { useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

const PENDING_ID_PREFIX = 'PENDING-'

type GroupsBoard = FunctionReturnType<typeof api.groups.listGroupsBoard>
type BoardStudent = GroupsBoard['ungrouped'][number]
type BoardGroup = GroupsBoard['groups'][number]
type BoardTeam = BoardGroup['teams'][number]

function pendingId<Table extends 'classGroups' | 'classTeams'>(): Id<Table> {
  return `${PENDING_ID_PREFIX}${crypto.randomUUID()}` as Id<Table>
}

function findStudentOnBoard(
  board: GroupsBoard,
  orgStudentId: Id<'orgStudents'>,
): BoardStudent | null {
  const fromUngrouped = board.ungrouped.find(
    (student) => student.orgStudentId === orgStudentId,
  )
  if (fromUngrouped) return fromUngrouped

  for (const group of board.groups) {
    const inGroup = group.studentsWithoutTeam.find(
      (student) => student.orgStudentId === orgStudentId,
    )
    if (inGroup) return inGroup
    for (const team of group.teams) {
      const inTeam = team.students.find(
        (student) => student.orgStudentId === orgStudentId,
      )
      if (inTeam) return inTeam
    }
  }
  return null
}

function removeStudentFromBoard(
  board: GroupsBoard,
  orgStudentId: Id<'orgStudents'>,
): GroupsBoard {
  return {
    ...board,
    ungrouped: board.ungrouped.filter(
      (student) => student.orgStudentId !== orgStudentId,
    ),
    groups: board.groups.map((group) => ({
      ...group,
      studentsWithoutTeam: group.studentsWithoutTeam.filter(
        (student) => student.orgStudentId !== orgStudentId,
      ),
      teams: group.teams.map((team) => ({
        ...team,
        students: team.students.filter(
          (student) => student.orgStudentId !== orgStudentId,
        ),
      })),
    })),
  }
}

function insertStudentSorted(
  students: Array<BoardStudent>,
  student: BoardStudent,
): Array<BoardStudent> {
  const next = [...students, student]
  next.sort((left, right) => left.displayName.localeCompare(right.displayName))
  return next
}

export function useCreateGroup() {
  return useMutation(api.groups.createGroup).withOptimisticUpdate(
    (localStore, args) => {
      const board = localStore.getQuery(api.groups.listGroupsBoard, {
        classId: args.classId,
      })
      if (!board) return

      const maxOrder = board.groups.reduce(
        (max, group) => Math.max(max, group.sortOrder ?? 0),
        0,
      )
      const nextGroup: BoardGroup = {
        _id: pendingId<'classGroups'>(),
        name: args.name,
        description: args.description,
        icon: args.icon,
        sortOrder: maxOrder + 1,
        studentsWithoutTeam: [],
        teams: [],
      }

      localStore.setQuery(
        api.groups.listGroupsBoard,
        { classId: args.classId },
        {
          ...board,
          groups: [...board.groups, nextGroup],
        },
      )
    },
  )
}

export function useUpdateGroup() {
  return useMutation(api.groups.updateGroup).withOptimisticUpdate(
    (localStore, args) => {
      for (const { args: queryArgs, value: board } of localStore.getAllQueries(
        api.groups.listGroupsBoard,
      )) {
        if (!board || !queryArgs) continue
        if (!board.groups.some((group) => group._id === args.groupId)) continue

        localStore.setQuery(api.groups.listGroupsBoard, queryArgs, {
          ...board,
          groups: board.groups.map((group) => {
            if (group._id !== args.groupId) return group
            return {
              ...group,
              name: args.name ?? group.name,
              description:
                args.description === undefined
                  ? group.description
                  : args.description === null
                    ? undefined
                    : args.description,
              icon:
                args.icon === undefined
                  ? group.icon
                  : args.icon === null
                    ? undefined
                    : args.icon,
            }
          }),
        })
        return
      }
    },
  )
}

export function useCreateTeam() {
  return useMutation(api.groups.createTeam).withOptimisticUpdate(
    (localStore, args) => {
      for (const { args: queryArgs, value: board } of localStore.getAllQueries(
        api.groups.listGroupsBoard,
      )) {
        if (!board || !queryArgs) continue
        if (!board.groups.some((group) => group._id === args.groupId)) continue

        localStore.setQuery(api.groups.listGroupsBoard, queryArgs, {
          ...board,
          groups: board.groups.map((group) => {
            if (group._id !== args.groupId) return group
            const maxOrder = group.teams.reduce(
              (max, team) => Math.max(max, team.sortOrder ?? 0),
              0,
            )
            const nextTeam: BoardTeam = {
              _id: pendingId<'classTeams'>(),
              name: args.name,
              description: args.description,
              icon: args.icon,
              sortOrder: maxOrder + 1,
              students: [],
            }
            return {
              ...group,
              teams: [...group.teams, nextTeam],
            }
          }),
        })
        return
      }
    },
  )
}

export function useUpdateTeam() {
  return useMutation(api.groups.updateTeam).withOptimisticUpdate(
    (localStore, args) => {
      for (const { args: queryArgs, value: board } of localStore.getAllQueries(
        api.groups.listGroupsBoard,
      )) {
        if (!board || !queryArgs) continue
        if (
          !board.groups.some((group) =>
            group.teams.some((team) => team._id === args.teamId),
          )
        ) {
          continue
        }

        localStore.setQuery(api.groups.listGroupsBoard, queryArgs, {
          ...board,
          groups: board.groups.map((group) => ({
            ...group,
            teams: group.teams.map((team) => {
              if (team._id !== args.teamId) return team
              return {
                ...team,
                name: args.name ?? team.name,
                description:
                  args.description === undefined
                    ? team.description
                    : args.description === null
                      ? undefined
                      : args.description,
                icon:
                  args.icon === undefined
                    ? team.icon
                    : args.icon === null
                      ? undefined
                      : args.icon,
              }
            }),
          })),
        })
        return
      }
    },
  )
}

export function useAssignStudent() {
  return useMutation(api.groups.assignStudent).withOptimisticUpdate(
    (localStore, args) => {
      for (const { args: queryArgs, value: board } of localStore.getAllQueries(
        api.groups.listGroupsBoard,
      )) {
        if (!board || !queryArgs) continue
        if (queryArgs.classId !== args.classId) continue

        const student = findStudentOnBoard(board, args.orgStudentId)
        if (!student) return

        let next = removeStudentFromBoard(board, args.orgStudentId)

        if (args.groupId === null) {
          next = {
            ...next,
            ungrouped: insertStudentSorted(next.ungrouped, student),
          }
        } else {
          next = {
            ...next,
            groups: next.groups.map((group) => {
              if (group._id !== args.groupId) return group
              if (args.teamId === null) {
                return {
                  ...group,
                  studentsWithoutTeam: insertStudentSorted(
                    group.studentsWithoutTeam,
                    student,
                  ),
                }
              }
              return {
                ...group,
                teams: group.teams.map((team) => {
                  if (team._id !== args.teamId) return team
                  return {
                    ...team,
                    students: insertStudentSorted(team.students, student),
                  }
                }),
              }
            }),
          }
        }

        localStore.setQuery(api.groups.listGroupsBoard, queryArgs, next)
        return
      }
    },
  )
}

export function useDeleteGroup() {
  return useMutation(api.groups.deleteGroup).withOptimisticUpdate(
    (localStore, args) => {
      for (const { args: queryArgs, value: board } of localStore.getAllQueries(
        api.groups.listGroupsBoard,
      )) {
        if (!board || !queryArgs) continue
        const group = board.groups.find((g) => g._id === args.groupId)
        if (!group) continue

        const released: Array<BoardStudent> = [
          ...group.studentsWithoutTeam,
          ...group.teams.flatMap((team) => team.students),
        ]
        let ungrouped = board.ungrouped
        for (const student of released) {
          ungrouped = insertStudentSorted(ungrouped, student)
        }

        localStore.setQuery(api.groups.listGroupsBoard, queryArgs, {
          ...board,
          ungrouped,
          groups: board.groups.filter((g) => g._id !== args.groupId),
        })
        return
      }
    },
  )
}

export function useDeleteTeam() {
  return useMutation(api.groups.deleteTeam).withOptimisticUpdate(
    (localStore, args) => {
      for (const { args: queryArgs, value: board } of localStore.getAllQueries(
        api.groups.listGroupsBoard,
      )) {
        if (!board || !queryArgs) continue
        const parent = board.groups.find((group) =>
          group.teams.some((team) => team._id === args.teamId),
        )
        if (!parent) continue

        const team = parent.teams.find((t) => t._id === args.teamId)
        if (!team) continue

        let studentsWithoutTeam = parent.studentsWithoutTeam
        for (const student of team.students) {
          studentsWithoutTeam = insertStudentSorted(
            studentsWithoutTeam,
            student,
          )
        }

        localStore.setQuery(api.groups.listGroupsBoard, queryArgs, {
          ...board,
          groups: board.groups.map((group) => {
            if (group._id !== parent._id) return group
            return {
              ...group,
              studentsWithoutTeam,
              teams: group.teams.filter((t) => t._id !== args.teamId),
            }
          }),
        })
        return
      }
    },
  )
}
