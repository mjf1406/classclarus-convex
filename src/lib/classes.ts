import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import { compareClasses, DEFAULT_CLASS_SORT } from './classSort'
import type { ClassSort } from './classSort'

export type { ClassSort } from './classSort'

/** Class roster roles, as returned in `myRole` by the class list queries. */
export type ClassRole =
  | 'creator'
  | 'classTeacher'
  | 'assistantTeacher'
  | 'student'

/** Display role including guardian (ReBAC access on getClass, not a roster role). */
export type ClassDisplayRole = ClassRole | 'guardian'

/**
 * The class shape returned by public queries: join codes and the display pin
 * are redacted server-side (codes are only available via getJoinCodes /
 * getClassAdminBundle).
 * `myRole` is the caller's highest roster role, or `guardian` on getClass when
 * access is via a linked child enrollment.
 * Permission flags are present on getClass; list queries omit them.
 */
export type ClassPublic = Omit<
  Doc<'classes'>,
  'studentCode' | 'teacherCode' | 'assistantTeacherCode' | 'publicDisplayPin'
> & {
  myRole: ClassDisplayRole | undefined
  canManage?: boolean
  canManageMembers?: boolean
}

type ListMyClass = {
  myRole: ClassRole | undefined
  _id: Id<'classes'>
  _creationTime: number
  userId: Id<'users'>
  name: string
  description?: string
  icon?: string
  year: number
  updatedTime?: number
  archivedTime?: number
  organizationId?: string
  teamId?: string
}

function toListMyClass(doc: ClassPublic): ListMyClass {
  return {
    _id: doc._id,
    _creationTime: doc._creationTime,
    userId: doc.userId,
    name: doc.name,
    description: doc.description,
    icon: doc.icon,
    year: doc.year,
    updatedTime: doc.updatedTime,
    archivedTime: doc.archivedTime,
    organizationId: doc.organizationId,
    teamId: doc.teamId,
    myRole: doc.myRole === 'guardian' ? undefined : doc.myRole,
  }
}

const PENDING_ID_PREFIX = 'PENDING-'

/** Home / optimistic-update query args — one subscription for active + archived. */
export const LIST_MY_CLASSES_ARGS = { includeArchived: true } as const

export function isPendingClass(classDoc: ClassPublic): boolean {
  return String(classDoc._id).startsWith(PENDING_ID_PREFIX)
}

function listQueryMode(queryArgs: {
  includeArchived?: boolean
  archivedOnly?: boolean
  sort?: ClassSort
}): 'active' | 'archived' | 'all' {
  if (queryArgs.archivedOnly) return 'archived'
  if (queryArgs.includeArchived) return 'all'
  return 'active'
}

/** Insert using the same ordering as the Convex list queries. */
function insertSorted(
  list: ListMyClass[],
  doc: ClassPublic,
  sort: ClassSort,
): ListMyClass[] {
  const next = [...list]
  const insertAt = next.findIndex(
    (existing) => compareClasses(doc, existing, sort) < 0,
  )
  next.splice(insertAt === -1 ? next.length : insertAt, 0, toListMyClass(doc))
  return next
}

function applyClassPatch(
  doc: ClassPublic,
  args: {
    name?: string
    description?: string
    icon?: string
    archived?: boolean
  },
  now: number,
): ClassPublic {
  const updated: ClassPublic = {
    ...doc,
    updatedTime: now,
  }

  if (args.name !== undefined) updated.name = args.name
  if (args.description !== undefined) updated.description = args.description
  if (args.icon !== undefined) updated.icon = args.icon
  if (args.archived === true) {
    updated.archivedTime = now
  } else if (args.archived === false) {
    delete updated.archivedTime
  }

  return updated
}

export function useCreateClass() {
  return useMutation(api.classes.createClass).withOptimisticUpdate(
    (localStore, args) => {
      const user = localStore.getQuery(api.users.current, {})
      if (!user) return

      const now = Date.now()
      const optimisticClass: ClassPublic = {
        _id: `${PENDING_ID_PREFIX}${crypto.randomUUID()}` as Id<'classes'>,
        _creationTime: now,
        userId: user._id,
        name: args.name,
        description: args.description,
        icon: args.icon,
        year: args.year,
        myRole: 'creator',
      }

      for (const { args: queryArgs, value } of localStore.getAllQueries(
        api.memberships.listMyClasses,
      )) {
        if (value === undefined) continue
        // New classes are active; only insert into active (or "all") lists.
        const mode = listQueryMode(queryArgs)
        if (mode === 'archived') continue
        localStore.setQuery(
          api.memberships.listMyClasses,
          queryArgs,
          insertSorted(
            value,
            optimisticClass,
            queryArgs.sort ?? DEFAULT_CLASS_SORT,
          ),
        )
      }
    },
  )
}

export function useUpdateClass() {
  return useMutation(api.classes.updateClass).withOptimisticUpdate(
    (localStore, args) => {
      const now = Date.now()

      const fromGet = localStore.getQuery(api.classes.getClass, {
        classId: args.classId,
      })

      let source: ClassPublic | undefined = fromGet ?? undefined
      if (!source) {
        for (const { value } of localStore.getAllQueries(
          api.memberships.listMyClasses,
        )) {
          const match = value?.find((c) => c._id === args.classId)
          if (match) {
            source = match
            break
          }
        }
      }
      if (!source) return

      const updated = applyClassPatch(source, args, now)
      const isArchived = updated.archivedTime !== undefined

      // getClass always returns permission flags; preserve them when patching.
      localStore.setQuery(api.classes.getClass, { classId: args.classId }, {
        ...updated,
        canManage: updated.canManage ?? false,
        canManageMembers: updated.canManageMembers ?? false,
      })

      for (const { args: queryArgs, value } of localStore.getAllQueries(
        api.memberships.listMyClasses,
      )) {
        if (value === undefined) continue

        const mode = listQueryMode(queryArgs)
        const index = value.findIndex((c) => c._id === args.classId)
        const belongsInList =
          mode === 'all' ||
          (mode === 'archived' && isArchived) ||
          (mode === 'active' && !isArchived)

        if (!belongsInList) {
          if (index === -1) continue
          localStore.setQuery(
            api.memberships.listMyClasses,
            queryArgs,
            value.filter((c) => c._id !== args.classId),
          )
          continue
        }

        if (index === -1) {
          localStore.setQuery(
            api.memberships.listMyClasses,
            queryArgs,
            insertSorted(value, updated, queryArgs.sort ?? DEFAULT_CLASS_SORT),
          )
          continue
        }

        const withoutUpdatedClass = value.filter(
          (classDoc) => classDoc._id !== args.classId,
        )
        localStore.setQuery(
          api.memberships.listMyClasses,
          queryArgs,
          insertSorted(
            withoutUpdatedClass,
            updated,
            queryArgs.sort ?? DEFAULT_CLASS_SORT,
          ),
        )
      }
    },
  )
}

export function useRemoveClass() {
  return useMutation(api.classes.removeClass).withOptimisticUpdate(
    (localStore, args) => {
      localStore.setQuery(api.classes.getClass, { classId: args.classId }, null)

      for (const { args: queryArgs, value } of localStore.getAllQueries(
        api.memberships.listMyClasses,
      )) {
        if (value === undefined) continue
        localStore.setQuery(
          api.memberships.listMyClasses,
          queryArgs,
          value.filter((c) => c._id !== args.classId),
        )
      }
    },
  )
}
