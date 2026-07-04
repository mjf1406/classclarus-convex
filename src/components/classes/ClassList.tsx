import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import {
  Archive,
  ArchiveRestore,
  BookText,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { useRemoveClass, useUpdateClass } from '#/lib/classes'
import { ONE_HOUR } from '#/lib/queryCache'
import { api } from '../../../convex/_generated/api'
import type { Doc } from '../../../convex/_generated/dataModel'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'

export type ClassListView = 'grid' | 'list'

type ClassListProps = {
  view?: ClassListView
  archivedOnly?: boolean
  onCreateClick?: () => void
  onEdit?: (classDoc: Doc<'classes'>) => void
}

function formatClassTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function formatUpdatedLabel(updatedTime: number | undefined) {
  return updatedTime === undefined ? 'N/A' : formatClassTimestamp(updatedTime)
}

function ClassTimestamps({ classDoc }: { classDoc: Doc<'classes'> }) {
  return (
    <div className="mt-2 space-y-0.5 text-2xs text-muted-foreground">
      <p>Created {formatClassTimestamp(classDoc._creationTime)}</p>
      <p>Updated {formatUpdatedLabel(classDoc.updatedTime)}</p>
    </div>
  )
}

function ClassActionsMenu({
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  onEdit?: () => void
  onArchive?: () => void
  onUnarchive?: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label="Class actions"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {onEdit && (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil />
            Edit
          </DropdownMenuItem>
        )}
        {onArchive && (
          <DropdownMenuItem onSelect={onArchive}>
            <Archive />
            Archive
          </DropdownMenuItem>
        )}
        {onUnarchive && (
          <DropdownMenuItem onSelect={onUnarchive}>
            <ArchiveRestore />
            Unarchive
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ClassCard({
  classDoc,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  classDoc: Doc<'classes'>
  onEdit?: () => void
  onArchive?: () => void
  onUnarchive?: () => void
  onDelete: () => void
}) {
  return (
    <Card
      size="sm"
      className="relative cursor-pointer transition-colors hover:bg-muted/30"
    >
      <Link
        to="/c/$classId"
        params={{ classId: classDoc._id }}
        className="absolute inset-0 z-0 rounded-[inherit]"
        aria-label={`Open ${classDoc.name}`}
      />
      <CardHeader className="relative z-10 pointer-events-none">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BookText className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="truncate text-base font-semibold">
                {classDoc.name}
              </CardTitle>
              <div className="pointer-events-auto">
                <ClassActionsMenu
                  onEdit={onEdit}
                  onArchive={onArchive}
                  onUnarchive={onUnarchive}
                  onDelete={onDelete}
                />
              </div>
            </div>
            {classDoc.description ? (
              <CardDescription className="mt-1 line-clamp-2">
                {classDoc.description}
              </CardDescription>
            ) : (
              <CardDescription className="mt-1 italic">
                No description
              </CardDescription>
            )}
            <ClassTimestamps classDoc={classDoc} />
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}

function ClassRow({
  classDoc,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  classDoc: Doc<'classes'>
  onEdit?: () => void
  onArchive?: () => void
  onUnarchive?: () => void
  onDelete: () => void
}) {
  return (
    <Card
      size="sm"
      className="relative cursor-pointer transition-colors hover:bg-muted/30"
    >
      <Link
        to="/c/$classId"
        params={{ classId: classDoc._id }}
        className="absolute inset-0 z-0 rounded-[inherit]"
        aria-label={`Open ${classDoc.name}`}
      />
      <CardHeader className="relative z-10 pointer-events-none py-0">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BookText className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="truncate text-base font-semibold">
                  {classDoc.name}
                </CardTitle>
                {classDoc.description ? (
                  <CardDescription className="mt-0.5 line-clamp-1">
                    {classDoc.description}
                  </CardDescription>
                ) : (
                  <CardDescription className="mt-0.5 italic">
                    No description
                  </CardDescription>
                )}
              </div>
              <div className="pointer-events-auto">
                <ClassActionsMenu
                  onEdit={onEdit}
                  onArchive={onArchive}
                  onUnarchive={onUnarchive}
                  onDelete={onDelete}
                />
              </div>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-2xs text-muted-foreground">
              <span>
                Created {formatClassTimestamp(classDoc._creationTime)}
              </span>
              <span>Updated {formatUpdatedLabel(classDoc.updatedTime)}</span>
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}

function ClassListSkeleton({ view }: { view: ClassListView }) {
  if (view === 'list') {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} size="sm">
            <CardHeader className="py-0">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Card key={i} size="sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <Skeleton className="size-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

function EmptyState({ onCreateClick }: { onCreateClick?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <BookText className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">No classes yet</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Create your first class to unlock the power of ClassClarus!
      </p>
      {onCreateClick && (
        <Button className="mt-6" onClick={onCreateClick}>
          <Plus data-icon="inline-start" />
          Create Class
        </Button>
      )}
    </div>
  )
}

export function ClassList({
  view = 'grid',
  archivedOnly = false,
  onCreateClick,
  onEdit,
}: ClassListProps) {
  const listArgs = archivedOnly ? { includeArchived: true as const } : {}
  const { data: classes, isPending } = useQuery({
    ...convexQuery(api.classes.listClasses, listArgs),
    gcTime: ONE_HOUR,
  })
  const updateClass = useUpdateClass()
  const removeClass = useRemoveClass()

  const [deletingClass, setDeletingClass] = useState<Doc<'classes'> | null>(
    null,
  )
  const [archivingClass, setArchivingClass] = useState<Doc<'classes'> | null>(
    null,
  )

  const displayedClasses = useMemo(() => {
    if (!classes) return []
    if (!archivedOnly) return classes
    return classes.filter((c) => c.archivedTime !== undefined)
  }, [classes, archivedOnly])

  const handleDelete = () => {
    if (!deletingClass) return

    const mutationPromise = removeClass({ classId: deletingClass._id })
    setDeletingClass(null)

    void mutationPromise
      .then(() => {
        toast.success('Class deleted')
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : 'Failed to delete class',
        )
      })
  }

  const handleArchive = () => {
    if (!archivingClass) return

    const mutationPromise = updateClass({
      classId: archivingClass._id,
      archived: true,
    })
    setArchivingClass(null)

    void mutationPromise
      .then(() => {
        toast.success('Class archived')
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : 'Failed to archive class',
        )
      })
  }

  const handleUnarchive = (classDoc: Doc<'classes'>) => {
    void updateClass({ classId: classDoc._id, archived: false })
      .then(() => {
        toast.success('Class restored')
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : 'Failed to restore class',
        )
      })
  }

  if (isPending || classes === undefined) {
    if (archivedOnly) return null
    return <ClassListSkeleton view={view} />
  }

  if (displayedClasses.length === 0) {
    if (archivedOnly) return null
    return <EmptyState onCreateClick={onCreateClick} />
  }

  return (
    <>
      <div
        className={
          view === 'list'
            ? 'flex flex-col gap-3'
            : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
        }
      >
        {displayedClasses.map((classDoc) =>
          view === 'list' ? (
            <ClassRow
              key={classDoc._id}
              classDoc={classDoc}
              onEdit={
                archivedOnly ? undefined : () => onEdit?.(classDoc)
              }
              onArchive={
                archivedOnly ? undefined : () => setArchivingClass(classDoc)
              }
              onUnarchive={
                archivedOnly ? () => handleUnarchive(classDoc) : undefined
              }
              onDelete={() => setDeletingClass(classDoc)}
            />
          ) : (
            <ClassCard
              key={classDoc._id}
              classDoc={classDoc}
              onEdit={
                archivedOnly ? undefined : () => onEdit?.(classDoc)
              }
              onArchive={
                archivedOnly ? undefined : () => setArchivingClass(classDoc)
              }
              onUnarchive={
                archivedOnly ? () => handleUnarchive(classDoc) : undefined
              }
              onDelete={() => setDeletingClass(classDoc)}
            />
          ),
        )}
      </div>

      <AlertDialog
        open={deletingClass !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingClass(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete class?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingClass
                ? `Delete “${deletingClass.name}”? This cannot be undone.`
                : 'This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={archivingClass !== null}
        onOpenChange={(open) => {
          if (!open) setArchivingClass(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive class?</AlertDialogTitle>
            <AlertDialogDescription>
              {archivingClass
                ? `Archive “${archivingClass.name}”? You can restore it from the Archived section later.`
                : 'You can restore it from the Archived section later.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleArchive()
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
