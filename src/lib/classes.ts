import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import {
  compareClasses,
  DEFAULT_CLASS_SORT,
} from './classSort'
import type { ClassSort } from './classSort'

export type { ClassSort } from './classSort'

const PENDING_CODE = 'PENDING'

export function isPendingClass(classDoc: Doc<'classes'>): boolean {
  return classDoc.studentCode === PENDING_CODE
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

/** Insert using the same ordering as the Convex `listClasses` query. */
function insertSorted(
  list: Doc<'classes'>[],
  doc: Doc<'classes'>,
  sort: ClassSort,
): Doc<'classes'>[] {
  const next = [...list]
  const insertAt = next.findIndex(
    (existing) => compareClasses(doc, existing, sort) < 0,
  )
  next.splice(insertAt === -1 ? next.length : insertAt, 0, doc)
  return next
}

function applyClassPatch(
  doc: Doc<'classes'>,
  args: {
    name?: string
    description?: string
    icon?: string
    publicDisplayPin?: string
    archived?: boolean
  },
  now: number,
): Doc<'classes'> {
  const updated: Doc<'classes'> = {
    ...doc,
    updatedTime: now,
  }

  if (args.name !== undefined) updated.name = args.name
  if (args.description !== undefined) updated.description = args.description
  if (args.icon !== undefined) updated.icon = args.icon
  if (args.publicDisplayPin !== undefined) {
    updated.publicDisplayPin = args.publicDisplayPin
  }
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
      const optimisticClass: Doc<'classes'> = {
        _id: crypto.randomUUID() as Id<'classes'>,
        _creationTime: now,
        userId: user._id,
        name: args.name,
        description: args.description,
        icon: args.icon,
        year: args.year,
        publicDisplayPin: args.publicDisplayPin,
        studentCode: PENDING_CODE,
        teacherCode: PENDING_CODE,
        assistantTeacherCode: PENDING_CODE,
      }

      for (const { args: queryArgs, value } of localStore.getAllQueries(
        api.classes.listClasses,
      )) {
        if (value === undefined) continue
        // New classes are active; only insert into active (or "all") lists.
        const mode = listQueryMode(queryArgs)
        if (mode === 'archived') continue
        localStore.setQuery(
          api.classes.listClasses,
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

      let source: Doc<'classes'> | undefined = fromGet ?? undefined
      if (!source) {
        for (const { value } of localStore.getAllQueries(
          api.classes.listClasses,
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

      localStore.setQuery(
        api.classes.getClass,
        { classId: args.classId },
        updated,
      )

      for (const { args: queryArgs, value } of localStore.getAllQueries(
        api.classes.listClasses,
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
            api.classes.listClasses,
            queryArgs,
            value.filter((c) => c._id !== args.classId),
          )
          continue
        }

        if (index === -1) {
          localStore.setQuery(
            api.classes.listClasses,
            queryArgs,
            insertSorted(value, updated, queryArgs.sort ?? DEFAULT_CLASS_SORT),
          )
          continue
        }

        const withoutUpdatedClass = value.filter(
          (classDoc) => classDoc._id !== args.classId,
        )
        localStore.setQuery(
          api.classes.listClasses,
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
      localStore.setQuery(
        api.classes.getClass,
        { classId: args.classId },
        null,
      )

      for (const { args: queryArgs, value } of localStore.getAllQueries(
        api.classes.listClasses,
      )) {
        if (value === undefined) continue
        localStore.setQuery(
          api.classes.listClasses,
          queryArgs,
          value.filter((c) => c._id !== args.classId),
        )
      }
    },
  )
}
