import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import { compareClasses, DEFAULT_CLASS_SORT } from './classSort'
import type { ClassSort } from './classSort'
import type { ClassLanguage } from '#/i18n/locales'
import { DEFAULT_CLASS_LANGUAGE } from '#/i18n/locales'
import i18n from '#/i18n'

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
 * Permission flags are present on getClass and listMyClasses.
 */
export type ClassPublic = Omit<
  Doc<'classes'>,
  | 'studentCode'
  | 'teacherCode'
  | 'assistantTeacherCode'
  | 'publicDisplayPin'
  | 'language'
> & {
  language: ClassLanguage
  myRole: ClassDisplayRole | undefined
  canManage?: boolean
  canManageMembers?: boolean
}

type ListMyClass = {
  myRole: ClassDisplayRole | undefined
  canManage: boolean
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
  language: ClassLanguage
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
    language: doc.language,
    myRole: doc.myRole,
    canManage: doc.canManage === true,
  }
}

const PENDING_ID_PREFIX = 'PENDING-'

/** Home / optimistic-update query args — one subscription for active + archived. */
export const LIST_MY_CLASSES_ARGS = { includeArchived: true } as const

export function isPendingClass(classDoc: ClassPublic): boolean {
  return String(classDoc._id).startsWith(PENDING_ID_PREFIX)
}

/** Insert using the same ordering as the Convex list queries. */
function insertSorted(
  list: ListMyClass[],
  doc: ClassPublic,
  sort: ClassSort,
): ListMyClass[] {
  const next = [...list]
  const insertAt = next.findIndex(
    (existing) =>
      compareClasses(doc, existing, sort, i18n.language) < 0,
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
    language?: ClassLanguage
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
  if (args.language !== undefined) updated.language = args.language
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
        language: args.language ?? DEFAULT_CLASS_LANGUAGE,
        myRole: 'creator',
        canManage: true,
      }

      const home = localStore.getQuery(api.memberships.getAccountHome, {})
      if (!home) return

      const currentList = home.classes.map((c) => toListMyClass(c))
      const nextClasses = insertSorted(
        currentList,
        optimisticClass,
        DEFAULT_CLASS_SORT,
      )

      localStore.setQuery(api.memberships.getAccountHome, {}, { ...home, classes: nextClasses })
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

      // getClass always returns permission flags; preserve them when patching.
      localStore.setQuery(api.classes.getClass, { classId: args.classId }, {
        ...updated,
        canManage: updated.canManage ?? false,
        canManageMembers: updated.canManageMembers ?? false,
      })

      const home = localStore.getQuery(api.memberships.getAccountHome, {})
      if (!home) return

      const currentList = home.classes.map((c) => toListMyClass(c))
      const withoutUpdatedClass = currentList.filter(
        (classDoc) => classDoc._id !== args.classId,
      )
      const nextClasses = insertSorted(
        withoutUpdatedClass,
        updated,
        DEFAULT_CLASS_SORT,
      )

      localStore.setQuery(api.memberships.getAccountHome, {}, { ...home, classes: nextClasses })
    },
  )
}

export function useRemoveClass() {
  return useMutation(api.classes.removeClass).withOptimisticUpdate(
    (localStore, args) => {
      localStore.setQuery(api.classes.getClass, { classId: args.classId }, null)

      const home = localStore.getQuery(api.memberships.getAccountHome, {})
      if (!home) return
      const nextClasses = home.classes.filter(
        (c) => c._id !== args.classId,
      )
      localStore.setQuery(api.memberships.getAccountHome, {}, { ...home, classes: nextClasses })
    },
  )
}
