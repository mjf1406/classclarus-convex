import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'

const PENDING_CODE = 'PENDING'

function applyClassPatch(
  doc: Doc<'classes'>,
  args: {
    name?: string
    description?: string
    icon?: string
    year?: number
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
  if (args.year !== undefined) updated.year = args.year
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
        guardianCode: PENDING_CODE,
      }

      for (const { args: queryArgs, value } of localStore.getAllQueries(
        api.classes.listClasses,
      )) {
        if (value === undefined) continue
        localStore.setQuery(api.classes.listClasses, queryArgs, [
          optimisticClass,
          ...value,
        ])
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

        const includeArchived = queryArgs.includeArchived ?? false
        const index = value.findIndex((c) => c._id === args.classId)

        if (!includeArchived && isArchived) {
          if (index === -1) continue
          localStore.setQuery(
            api.classes.listClasses,
            queryArgs,
            value.filter((c) => c._id !== args.classId),
          )
          continue
        }

        if (index === -1) {
          // Unarchived class should reappear in active lists.
          if (!includeArchived && !isArchived) {
            localStore.setQuery(api.classes.listClasses, queryArgs, [
              updated,
              ...value,
            ])
          }
          continue
        }

        const next = [...value]
        next[index] = updated
        localStore.setQuery(api.classes.listClasses, queryArgs, next)
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
