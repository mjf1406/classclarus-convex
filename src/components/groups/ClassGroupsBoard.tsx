import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import {
  Download,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  UsersRound,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { GroupEntityFormCredenza } from '@/components/groups/GroupEntityFormCredenza'
import type { GroupEntityDraft } from '@/components/groups/GroupEntityFormCredenza'
import { FontAwesomeIconFromId } from '@/components/icons/FontAwesomeIconFromId'
import { useAssignStudent, useDeleteGroup, useDeleteTeam } from '@/lib/groups'
import { ONE_HOUR } from '@/lib/queryCache'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type BoardStudent = {
  orgStudentId: Id<'orgStudents'>
  displayName: string
  rosterNumber: number
}

type DropTarget =
  | { kind: 'ungrouped' }
  | { kind: 'group'; groupId: Id<'classGroups'> }
  | { kind: 'team'; groupId: Id<'classGroups'>; teamId: Id<'classTeams'> }

function parseDropId(id: string): DropTarget | null {
  if (id === 'ungrouped') return { kind: 'ungrouped' }
  if (id.startsWith('group:')) {
    return {
      kind: 'group',
      groupId: id.slice('group:'.length) as Id<'classGroups'>,
    }
  }
  if (id.startsWith('team:')) {
    const rest = id.slice('team:'.length)
    const sep = rest.indexOf(':')
    if (sep <= 0) return null
    return {
      kind: 'team',
      groupId: rest.slice(0, sep) as Id<'classGroups'>,
      teamId: rest.slice(sep + 1) as Id<'classTeams'>,
    }
  }
  return null
}

function studentDragId(orgStudentId: Id<'orgStudents'>): string {
  return `student:${orgStudentId}`
}

function parseStudentDragId(id: string): Id<'orgStudents'> | null {
  if (!id.startsWith('student:')) return null
  return id.slice('student:'.length) as Id<'orgStudents'>
}

function StudentChip({
  student,
  forceHidden = false,
}: {
  student: BoardStudent
  /** Keep hidden after drag ends until the optimistic board move paints. */
  forceHidden?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: studentDragId(student.orgStudentId),
    data: { student },
  })

  return (
    <button
      type="button"
      ref={setNodeRef}
      className={cn(
        'rounded-md border bg-background px-2.5 py-1.5 text-left text-sm shadow-xs',
        'cursor-grab active:cursor-grabbing hover:bg-muted/60',
        (isDragging || forceHidden) && 'invisible',
      )}
      {...listeners}
      {...attributes}
    >
      {student.rosterNumber < Number.MAX_SAFE_INTEGER
        ? `#${student.rosterNumber} ${student.displayName}`
        : student.displayName}
    </button>
  )
}

function DropZone({
  id,
  title,
  iconId,
  description,
  children,
  className,
  actions,
}: {
  id: string
  title: string
  iconId?: string
  description?: string
  children: React.ReactNode
  className?: string
  actions?: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-28 flex-col gap-3 rounded-lg border bg-muted/20 p-3 transition-colors',
        isOver && 'border-primary bg-primary/5',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <FontAwesomeIconFromId
              id={iconId}
              className="size-4 shrink-0 text-muted-foreground"
              fallback={
                <UsersRound className="size-4 shrink-0 text-muted-foreground" />
              }
            />
            <h3 className="truncate font-medium">{title}</h3>
          </div>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

type PendingDelete =
  | { kind: 'group'; groupId: Id<'classGroups'>; name: string }
  | { kind: 'team'; teamId: Id<'classTeams'>; name: string }

export function ClassGroupsBoard({ classId }: { classId: Id<'classes'> }) {
  const { t } = useTranslation(['classes', 'common'])
  const { data: board } = useQuery({
    ...convexQuery(api.groups.listGroupsBoard, { classId }),
    gcTime: ONE_HOUR,
  })
  const assignStudent = useAssignStudent()
  const deleteGroup = useDeleteGroup()
  const deleteTeam = useDeleteTeam()

  const [activeStudent, setActiveStudent] = useState<BoardStudent | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<GroupEntityDraft | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const openCreateGroup = () => {
    setDraft({
      kind: 'group',
      mode: 'create',
      classId,
      name: '',
    })
    setFormOpen(true)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const student = event.active.data.current?.student as
      | BoardStudent
      | undefined
    setActiveStudent(student ?? null)
  }

  const clearActiveStudentAfterPaint = () => {
    // Double rAF: wait until after the optimistic TanStack board update commits
    // so the chip is already in the drop target when the overlay is removed.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setActiveStudent(null)
      })
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const orgStudentId = parseStudentDragId(String(event.active.id))
    const target = event.over ? parseDropId(String(event.over.id)) : null

    if (orgStudentId && target) {
      const mutationPromise =
        target.kind === 'ungrouped'
          ? assignStudent({
              classId,
              orgStudentId,
              groupId: null,
              teamId: null,
            })
          : target.kind === 'group'
            ? assignStudent({
                classId,
                orgStudentId,
                groupId: target.groupId,
                teamId: null,
              })
            : assignStudent({
                classId,
                orgStudentId,
                groupId: target.groupId,
                teamId: target.teamId,
              })

      void mutationPromise.catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : t('assignStudentFailed'),
        )
      })
    }

    clearActiveStudentAfterPaint()
  }

  const handleDragCancel = () => {
    clearActiveStudentAfterPaint()
  }

  const handleExport = async () => {
    if (!board) return
    setIsExporting(true)
    try {
      const { downloadGroupsPdf } = await import('@/lib/groupsPdf')
      await downloadGroupsPdf({
        className: board.className,
        year: board.year,
        groups: board.groups.map((group) => ({
          name: group.name,
          description: group.description,
          studentsWithoutTeam: group.studentsWithoutTeam,
          teams: group.teams,
        })),
      })
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : t('downloadGroupsPdfFailed'),
      )
    } finally {
      setIsExporting(false)
    }
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    setIsDeleting(true)

    const mutationPromise =
      pendingDelete.kind === 'group'
        ? deleteGroup({ groupId: pendingDelete.groupId })
        : deleteTeam({ teamId: pendingDelete.teamId })
    const successKey =
      pendingDelete.kind === 'group' ? 'groupDeleted' : 'teamDeleted'

    setPendingDelete(null)

    void mutationPromise
      .then(() => {
        toast.success(t(successKey))
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : t('deleteFailed'))
      })
      .finally(() => {
        setIsDeleting(false)
      })
  }

  if (board === undefined) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {t('groupsTitle')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('groupsDescription')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleExport()}
            disabled={isExporting}
          >
            <Download className="size-4" />
            {t('downloadGroupsPdf')}
          </Button>
          <Button type="button" onClick={openCreateGroup}>
            <Plus className="size-4" />
            {t('createGroup')}
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(220px,280px)_1fr]">
          <DropZone id="ungrouped" title={t('ungrouped')}>
            {board.ungrouped.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('noUngrouped')}
              </p>
            ) : (
              board.ungrouped.map((student) => (
                <StudentChip
                  key={student.orgStudentId}
                  student={student}
                  forceHidden={
                    activeStudent?.orgStudentId === student.orgStudentId
                  }
                />
              ))
            )}
          </DropZone>

          <div className="flex flex-col gap-4">
            {board.groups.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                {t('noGroupsYet')}
              </div>
            ) : (
              board.groups.map((group) => (
                <div
                  key={group._id}
                  className="flex flex-col gap-3 rounded-xl border bg-background p-3"
                >
                  <DropZone
                    id={`group:${group._id}`}
                    title={group.name}
                    iconId={group.icon}
                    description={group.description}
                    actions={
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 px-2"
                          onClick={() => {
                            setDraft({
                              kind: 'team',
                              mode: 'create',
                              groupId: group._id,
                              name: '',
                            })
                            setFormOpen(true)
                          }}
                        >
                          <Plus className="size-3.5" />
                          {t('createTeam')}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={t('groupActions')}
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setDraft({
                                  kind: 'group',
                                  mode: 'edit',
                                  groupId: group._id,
                                  name: group.name,
                                  description: group.description,
                                  icon: group.icon,
                                })
                                setFormOpen(true)
                              }}
                            >
                              <Pencil className="size-4" />
                              {t('editGroup')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() =>
                                setPendingDelete({
                                  kind: 'group',
                                  groupId: group._id,
                                  name: group.name,
                                })
                              }
                            >
                              <Trash2 className="size-4" />
                              {t('deleteGroup')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    }
                  >
                    {group.studentsWithoutTeam.map((student) => (
                      <StudentChip
                        key={student.orgStudentId}
                        student={student}
                        forceHidden={
                          activeStudent?.orgStudentId === student.orgStudentId
                        }
                      />
                    ))}
                    {group.studentsWithoutTeam.length === 0 &&
                    group.teams.every((team) => team.students.length === 0) ? (
                      <p className="text-sm text-muted-foreground">
                        {t('dropStudentsHere')}
                      </p>
                    ) : null}
                  </DropZone>

                  {group.teams.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {group.teams.map((team) => (
                        <DropZone
                          key={team._id}
                          id={`team:${group._id}:${team._id}`}
                          title={team.name}
                          iconId={team.icon}
                          description={team.description}
                          className="bg-muted/10"
                          actions={
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  aria-label={t('teamActions')}
                                >
                                  <MoreVertical className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setDraft({
                                      kind: 'team',
                                      mode: 'edit',
                                      teamId: team._id,
                                      name: team.name,
                                      description: team.description,
                                      icon: team.icon,
                                    })
                                    setFormOpen(true)
                                  }}
                                >
                                  <Pencil className="size-4" />
                                  {t('editTeam')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() =>
                                    setPendingDelete({
                                      kind: 'team',
                                      teamId: team._id,
                                      name: team.name,
                                    })
                                  }
                                >
                                  <Trash2 className="size-4" />
                                  {t('deleteTeam')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          }
                        >
                          {team.students.map((student) => (
                            <StudentChip
                              key={student.orgStudentId}
                              student={student}
                              forceHidden={
                                activeStudent?.orgStudentId ===
                                student.orgStudentId
                              }
                            />
                          ))}
                          {team.students.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              {t('dropStudentsHere')}
                            </p>
                          ) : null}
                        </DropZone>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeStudent ? (
            <div className="rounded-md border bg-background px-2.5 py-1.5 text-sm shadow-md">
              {activeStudent.rosterNumber < Number.MAX_SAFE_INTEGER
                ? `#${activeStudent.rosterNumber} ${activeStudent.displayName}`
                : activeStudent.displayName}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <GroupEntityFormCredenza
        open={formOpen}
        onOpenChange={setFormOpen}
        draft={draft}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.kind === 'team'
                ? t('deleteTeamTitle')
                : t('deleteGroupTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === 'team'
                ? t('deleteTeamDescription', { name: pendingDelete.name })
                : t('deleteGroupDescription', {
                    name: pendingDelete?.name ?? '',
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('common:cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault()
                confirmDelete()
              }}
            >
              {t('common:delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
