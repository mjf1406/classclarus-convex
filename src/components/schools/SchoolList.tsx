import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Archive,
  ArchiveRestore,
  MoreVertical,
  Pencil,
  Plus,
  School,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { OrgRoleBadge } from '#/components/schools/OrgRoleBadge'
import type { ClassListView } from '#/components/classes/ClassList'
import type { ClassSort } from '#/lib/classSort'
import { DEFAULT_CLASS_SORT } from '#/lib/classSort'
import { formatLocalizedDateTime } from '#/i18n/formatDate'
import {
  isPendingSchool,
  isSchoolArchived,
  sortSchools,
  useArchiveSchool,
  useDeleteSchool,
  useUnarchiveSchool,
} from '#/lib/schools'
import type { SchoolPublic } from '#/lib/schools'
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

type SchoolListProps = {
  schools: Array<SchoolPublic> | undefined
  view?: ClassListView
  sort?: ClassSort
  archivedOnly?: boolean
  roleFiltered?: boolean
  onCreateClick?: () => void
  onEdit?: (school: SchoolPublic) => void
}

function SchoolActionsMenu({
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
  const { t } = useTranslation(['schools', 'common'])
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('common:openUserMenu')}
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil />
          {t('edit')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onArchiveToggle}>
          {isArchived ? <ArchiveRestore /> : <Archive />}
          {isArchived ? t('unarchive') : t('archive')}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 />
          {t('common:delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SchoolCard({
  school,
  onEdit,
  onArchiveToggle,
  onDelete,
}: {
  school: SchoolPublic
  onEdit: () => void
  onArchiveToggle: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation(['home', 'schools'])
  const isArchived = isSchoolArchived(school)
  const isPending = isPendingSchool(school)
  const canManage = school.canManage === true

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
          to="/s/$schoolId"
          params={{ schoolId: school._id }}
          className="absolute inset-0 z-0 rounded-[inherit]"
          aria-label={t('schools:openSchool', { name: school.name })}
          preload={false}
        />
      )}
      <CardHeader className="relative z-10 min-w-0 pointer-events-none">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <School className="size-5" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0 flex-1 overflow-hidden">
                <CardTitle
                  className="truncate text-base font-semibold"
                  title={school.name}
                >
                  {school.name}
                </CardTitle>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {isPending ? t('creating') : school.slug}
                  </p>
                  <OrgRoleBadge role={school.myRole} />
                </div>
              </div>
              {!isPending && canManage ? (
                <div className="pointer-events-auto shrink-0">
                  <SchoolActionsMenu
                    isArchived={isArchived}
                    onEdit={onEdit}
                    onArchiveToggle={onArchiveToggle}
                    onDelete={onDelete}
                  />
                </div>
              ) : null}
            </div>
            <div className="mt-2 space-y-0.5 text-2xs text-muted-foreground">
              <p>
                {t('createdAt', {
                  date: formatLocalizedDateTime(school._creationTime),
                })}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}

function SchoolRow({
  school,
  onEdit,
  onArchiveToggle,
  onDelete,
}: {
  school: SchoolPublic
  onEdit: () => void
  onArchiveToggle: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation(['home', 'schools'])
  const isArchived = isSchoolArchived(school)
  const isPending = isPendingSchool(school)
  const canManage = school.canManage === true

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
          to="/s/$schoolId"
          params={{ schoolId: school._id }}
          className="absolute inset-0 z-0 rounded-[inherit]"
          aria-label={t('schools:openSchool', { name: school.name })}
          preload={false}
        />
      )}
      <CardHeader className="relative z-10 min-w-0 pointer-events-none py-0">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <School className="size-5" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex min-w-0 items-baseline gap-2">
                  <CardTitle
                    className="min-w-0 truncate text-base font-semibold"
                    title={school.name}
                  >
                    {school.name}
                  </CardTitle>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {isPending ? t('creating') : school.slug}
                  </span>
                  <OrgRoleBadge role={school.myRole} />
                </div>
              </div>
              {!isPending && canManage ? (
                <div className="pointer-events-auto shrink-0">
                  <SchoolActionsMenu
                    isArchived={isArchived}
                    onEdit={onEdit}
                    onArchiveToggle={onArchiveToggle}
                    onDelete={onDelete}
                  />
                </div>
              ) : null}
            </div>
            <div className="mt-1 text-2xs text-muted-foreground">
              {t('createdAt', {
                date: formatLocalizedDateTime(school._creationTime),
              })}
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}

function SchoolListSkeleton({ view }: { view: ClassListView }) {
  if (view === 'list') {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} size="sm">
            <CardHeader className="py-0">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-2 h-3 w-24" />
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
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-20" />
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
  roleFiltered,
  onCreateClick,
}: {
  archivedOnly?: boolean
  roleFiltered?: boolean
  onCreateClick?: () => void
}) {
  const { t } = useTranslation('schools')
  const title = roleFiltered
    ? archivedOnly
      ? t('noArchivedSchoolsForRole')
      : t('noSchoolsForRole')
    : archivedOnly
      ? t('noArchivedSchools')
      : t('noSchools')

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <School className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {!roleFiltered && !archivedOnly && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {t('emptyCta')}
        </p>
      )}
      {!roleFiltered && !archivedOnly && onCreateClick && (
        <Button className="mt-6" onClick={onCreateClick}>
          <Plus data-icon="inline-start" />
          {t('createSchool')}
        </Button>
      )}
    </div>
  )
}

export function SchoolList({
  schools,
  view = 'grid',
  sort = DEFAULT_CLASS_SORT,
  archivedOnly = false,
  roleFiltered = false,
  onCreateClick,
  onEdit,
}: SchoolListProps) {
  const { t, i18n } = useTranslation(['schools', 'common'])
  const sortedSchools = schools
    ? sortSchools(schools, sort, i18n.language)
    : undefined
  const archiveSchool = useArchiveSchool()
  const unarchiveSchool = useUnarchiveSchool()
  const deleteSchool = useDeleteSchool()
  const [deletingSchool, setDeletingSchool] = useState<SchoolPublic | null>(
    null,
  )

  const handleArchiveToggle = (school: SchoolPublic) => {
    const archive = !isSchoolArchived(school)
    const run = archive ? archiveSchool : unarchiveSchool
    void run({ schoolId: school._id })
      .then(() => {
        toast.success(archive ? t('schoolArchived') : t('schoolUnarchived'))
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
    if (!deletingSchool) return
    const mutationPromise = deleteSchool({ schoolId: deletingSchool._id })
    setDeletingSchool(null)
    void mutationPromise
      .then(() => {
        toast.success(t('schoolDeleted'))
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : t('deleteFailed'),
        )
      })
  }

  if (sortedSchools === undefined) {
    return <SchoolListSkeleton view={view} />
  }

  if (sortedSchools.length === 0) {
    return (
      <EmptyState
        archivedOnly={archivedOnly}
        roleFiltered={roleFiltered}
        onCreateClick={onCreateClick}
      />
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
        {sortedSchools.map((school) =>
          view === 'list' ? (
            <SchoolRow
              key={school._id}
              school={school}
              onEdit={() => onEdit?.(school)}
              onArchiveToggle={() => handleArchiveToggle(school)}
              onDelete={() => setDeletingSchool(school)}
            />
          ) : (
            <SchoolCard
              key={school._id}
              school={school}
              onEdit={() => onEdit?.(school)}
              onArchiveToggle={() => handleArchiveToggle(school)}
              onDelete={() => setDeletingSchool(school)}
            />
          ),
        )}
      </div>

      <AlertDialog
        open={deletingSchool !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingSchool(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteSchoolTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingSchool
                ? t('deleteSchoolDescription', { name: deletingSchool.name })
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
