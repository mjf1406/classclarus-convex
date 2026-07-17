import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Archive,
  ArchiveRestore,
  BookText,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  isPendingClass,
  useRemoveClass,
  useUpdateClass,
} from '#/lib/classes'
import type { ClassPublic, ClassSort } from '#/lib/classes'
import { DEFAULT_CLASS_SORT, sortClasses } from '#/lib/classSort'
import { ClassRoleBadge } from '#/components/classes/ClassRoleBadge'
import { formatLocalizedDateTime } from '#/i18n/formatDate'
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
  /** Undefined while the parent query is still loading. */
  classes: Array<ClassPublic> | undefined
  view?: ClassListView
  sort?: ClassSort
  archivedOnly?: boolean
  onCreateClick?: () => void
  onEdit?: (classDoc: ClassPublic) => void
}

function formatUpdatedLabel(
  updatedTime: number | undefined,
  notAvailable: string,
) {
  return updatedTime === undefined
    ? notAvailable
    : formatLocalizedDateTime(updatedTime)
}

function ClassTimestamps({ classDoc }: { classDoc: ClassPublic }) {
  const { t } = useTranslation(['home', 'common'])
  return (
    <div className="mt-2 space-y-0.5 text-2xs text-muted-foreground">
      <p>
        {t('createdAt', {
          date: formatLocalizedDateTime(classDoc._creationTime),
        })}
      </p>
      <p>
        {t('updatedAt', {
          date: formatUpdatedLabel(
            classDoc.updatedTime,
            t('common:notAvailable'),
          ),
        })}
      </p>
    </div>
  )
}

function ClassActionsMenu({
  isArchived,
  onEdit,
  onArchiveToggle,
  onDelete,
}: {
  isArchived: boolean
  onEdit: () => void
  onArchiveToggle: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation(['classes', 'common'])
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label={t('classActions')}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil />
          {t('edit')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onArchiveToggle}>
          {isArchived ? <ArchiveRestore /> : <Archive />}
          {isArchived ? t('unarchive') : t('archive')}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          {t('common:delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ClassCard({
  classDoc,
  onEdit,
  onArchiveToggle,
  onDelete,
}: {
  classDoc: ClassPublic
  onEdit: () => void
  onArchiveToggle: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation('home')
  const isArchived = classDoc.archivedTime !== undefined
  const isPending = isPendingClass(classDoc)
  const canManage = classDoc.canManage === true

  return (
    <Card
      size="sm"
      className={
        isPending
          ? 'relative cursor-default opacity-80'
          : 'relative cursor-pointer transition-colors hover:bg-muted/30'
      }
    >
      {isPending ? null : (
        <Link
          to="/c/$classId"
          params={{ classId: classDoc._id }}
          className="absolute inset-0 z-0 rounded-[inherit]"
          aria-label={t('openClass', { name: classDoc.name })}
          preload={false}
        />
      )}
      <CardHeader className="relative z-10 min-w-0 pointer-events-none">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BookText className="size-5" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0 flex-1 overflow-hidden">
                <CardTitle
                  className="truncate text-base font-semibold"
                  title={classDoc.name}
                >
                  {classDoc.name}
                </CardTitle>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {isPending ? t('creating') : classDoc.year}
                  </p>
                  <ClassRoleBadge role={classDoc.myRole} />
                </div>
              </div>
              {!isPending && canManage ? (
                <div className="pointer-events-auto shrink-0">
                  <ClassActionsMenu
                    isArchived={isArchived}
                    onEdit={onEdit}
                    onArchiveToggle={onArchiveToggle}
                    onDelete={onDelete}
                  />
                </div>
              ) : null}
            </div>
            {classDoc.description ? (
              <CardDescription className="mt-1 line-clamp-2">
                {classDoc.description}
              </CardDescription>
            ) : (
              <CardDescription className="mt-1 italic">
                {t('noDescription')}
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
  onArchiveToggle,
  onDelete,
}: {
  classDoc: ClassPublic
  onEdit: () => void
  onArchiveToggle: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation(['home', 'common'])
  const isArchived = classDoc.archivedTime !== undefined
  const isPending = isPendingClass(classDoc)
  const canManage = classDoc.canManage === true

  return (
    <Card
      size="sm"
      className={
        isPending
          ? 'relative cursor-default opacity-80'
          : 'relative cursor-pointer transition-colors hover:bg-muted/30'
      }
    >
      {isPending ? null : (
        <Link
          to="/c/$classId"
          params={{ classId: classDoc._id }}
          className="absolute inset-0 z-0 rounded-[inherit]"
          aria-label={t('openClass', { name: classDoc.name })}
          preload={false}
        />
      )}
      <CardHeader className="relative z-10 min-w-0 pointer-events-none py-0">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BookText className="size-5" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex min-w-0 items-baseline gap-2">
                  <CardTitle
                    className="min-w-0 truncate text-base font-semibold"
                    title={classDoc.name}
                  >
                    {classDoc.name}
                  </CardTitle>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {isPending ? t('creating') : classDoc.year}
                  </span>
                  <ClassRoleBadge role={classDoc.myRole} />
                </div>
                {classDoc.description ? (
                  <CardDescription className="mt-0.5 line-clamp-1">
                    {classDoc.description}
                  </CardDescription>
                ) : (
                  <CardDescription className="mt-0.5 italic">
                    {t('noDescription')}
                  </CardDescription>
                )}
              </div>
              {!isPending && canManage ? (
                <div className="pointer-events-auto shrink-0">
                  <ClassActionsMenu
                    isArchived={isArchived}
                    onEdit={onEdit}
                    onArchiveToggle={onArchiveToggle}
                    onDelete={onDelete}
                  />
                </div>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-2xs text-muted-foreground">
              <span>
                {t('createdAt', {
                  date: formatLocalizedDateTime(classDoc._creationTime),
                })}
              </span>
              <span>
                {t('updatedAt', {
                  date: formatUpdatedLabel(
                    classDoc.updatedTime,
                    t('common:notAvailable'),
                  ),
                })}
              </span>
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
                <Skeleton className="size-10 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex h-6 items-baseline gap-2">
                        <div className="flex h-6 items-center">
                          <Skeleton className="h-4 w-40" />
                        </div>
                        <div className="flex h-4 items-center">
                          <Skeleton className="h-3 w-10" />
                        </div>
                      </div>
                      <div className="mt-0.5 flex h-5 items-center">
                        <Skeleton className="h-4 w-56" />
                      </div>
                    </div>
                    <Skeleton className="size-8 shrink-0 rounded-md" />
                  </div>
                  <div className="mt-1 flex h-[17px] items-center gap-4">
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-3 w-36" />
                  </div>
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
              <Skeleton className="size-10 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex h-6 items-center">
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                    <div className="mt-0.5 flex h-4 items-center">
                      <Skeleton className="h-3 w-10" />
                    </div>
                  </div>
                  <Skeleton className="size-8 shrink-0 rounded-md" />
                </div>
                <div className="mt-1 flex h-5 items-center">
                  <Skeleton className="h-4 w-full" />
                </div>
                <div className="mt-2 space-y-0.5">
                  <div className="flex h-[17px] items-center">
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <div className="flex h-[17px] items-center">
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

function EmptyState({
  archivedOnly,
  onCreateClick,
}: {
  archivedOnly?: boolean
  onCreateClick?: () => void
}) {
  const { t } = useTranslation('home')
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <BookText className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">
        {archivedOnly ? t('noArchivedClasses') : t('noClasses')}
      </h2>
      {!archivedOnly && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {t('emptyCta')}
        </p>
      )}
      {!archivedOnly && onCreateClick && (
        <Button className="mt-6" onClick={onCreateClick}>
          <Plus data-icon="inline-start" />
          {t('createClass')}
        </Button>
      )}
    </div>
  )
}

export function ClassList({
  classes,
  view = 'grid',
  sort = DEFAULT_CLASS_SORT,
  archivedOnly = false,
  onCreateClick,
  onEdit,
}: ClassListProps) {
  const { t, i18n } = useTranslation(['home', 'classes', 'common'])
  const sortedClasses = classes
    ? sortClasses(classes, sort, i18n.language)
    : undefined
  const removeClass = useRemoveClass()
  const updateClass = useUpdateClass()

  const [deletingClass, setDeletingClass] = useState<ClassPublic | null>(
    null,
  )

  const handleArchiveToggle = (classDoc: ClassPublic) => {
    const archive = classDoc.archivedTime === undefined
    void updateClass({ classId: classDoc._id, archived: archive })
      .then(() => {
        toast.success(archive ? t('classArchived') : t('classUnarchived'))
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : archive
              ? t('archiveFailed')
              : t('unarchiveFailed'),
        )
      })
  }

  const handleDelete = () => {
    if (!deletingClass) return

    const mutationPromise = removeClass({ classId: deletingClass._id })
    setDeletingClass(null)

    void mutationPromise
      .then(() => {
        toast.success(t('classDeleted'))
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : t('classes:deleteFailed'),
        )
      })
  }

  if (sortedClasses === undefined) {
    return <ClassListSkeleton view={view} />
  }

  if (sortedClasses.length === 0) {
    return (
      <EmptyState archivedOnly={archivedOnly} onCreateClick={onCreateClick} />
    )
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
        {sortedClasses.map((classDoc) =>
          view === 'list' ? (
            <ClassRow
              key={classDoc._id}
              classDoc={classDoc}
              onEdit={() => onEdit?.(classDoc)}
              onArchiveToggle={() => handleArchiveToggle(classDoc)}
              onDelete={() => setDeletingClass(classDoc)}
            />
          ) : (
            <ClassCard
              key={classDoc._id}
              classDoc={classDoc}
              onEdit={() => onEdit?.(classDoc)}
              onArchiveToggle={() => handleArchiveToggle(classDoc)}
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
            <AlertDialogTitle>{t('classes:deleteClassTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingClass
                ? t('classes:deleteClassDescription', {
                    name: deletingClass.name,
                  })
                : t('common:cannotUndo')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
            >
              {t('common:delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
