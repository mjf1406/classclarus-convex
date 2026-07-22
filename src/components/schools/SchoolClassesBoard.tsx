import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { BookOpen, Plus, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ClassFormCredenza } from '#/components/classes/ClassFormCredenza'
import { OrgRoleBadge } from '#/components/schools/OrgRoleBadge'
import {
  useAssignClassStaff,
  useAssignClassToTeam,
  useCreateOrgStudent,
  useEnrollStudent,
  useRemoveClassStaff,
  useUnenrollStudent,
} from '#/lib/schoolClasses'
import { ONE_HOUR } from '#/lib/queryCache'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import {
  Credenza,
  CredenzaBody,
  CredenzaClose,
  CredenzaContent,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from '@/components/ui/credenza'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type SchoolClass = {
  _id: Id<'classes'>
  name: string
  year: number
  teamId?: string
}

type TeamNode = {
  team: {
    _id: string
    name: string
    parentTeamId?: string
  }
  children: Array<TeamNode>
}

type StaffMember = {
  userId: string
  name?: string
  email?: string
  role: string
}

type OrgStudent = {
  _id: Id<'orgStudents'>
  displayName: string
  firstName: string
  lastName: string
}

type RosterStudent = {
  orgStudentId: Id<'orgStudents'>
  displayName: string
}

type DragPayload =
  | { kind: 'class'; classId: Id<'classes'> }
  | { kind: 'staff'; userId: Id<'users'> }
  | { kind: 'student'; orgStudentId: Id<'orgStudents'> }

function flattenTeams(
  nodes: Array<TeamNode>,
): Array<{ id: string; name: string; depth: number }> {
  const out: Array<{ id: string; name: string; depth: number }> = []
  const walk = (list: Array<TeamNode>, depth: number) => {
    for (const node of list) {
      out.push({ id: node.team._id, name: node.team.name, depth })
      walk(node.children, depth + 1)
    }
  }
  walk(nodes, 0)
  return out
}

function ClassChip({
  cls,
  selected,
  onSelect,
  forceHidden = false,
}: {
  cls: SchoolClass
  selected: boolean
  onSelect: () => void
  forceHidden?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `class:${cls._id}`,
    data: { kind: 'class', classId: cls._id } satisfies DragPayload,
  })
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg border bg-background px-3 py-2 text-left text-sm shadow-sm',
        selected && 'ring-2 ring-ring',
        (isDragging || forceHidden) && 'opacity-40',
      )}
    >
      <BookOpen className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-medium">{cls.name}</span>
      <span className="text-xs text-muted-foreground">{cls.year}</span>
    </button>
  )
}

function PersonChip({
  id,
  label,
  dragData,
  badge,
  forceHidden = false,
}: {
  id: string
  label: string
  dragData: DragPayload
  badge?: ReactNode
  forceHidden?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: dragData,
  })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'flex cursor-grab items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-sm active:cursor-grabbing',
        (isDragging || forceHidden) && 'opacity-40',
      )}
    >
      <Users className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge}
    </div>
  )
}

function DropLane({
  id,
  title,
  children,
  emptyLabel,
}: {
  id: string
  title: string
  children: ReactNode
  emptyLabel?: string
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-36 flex-col gap-2 rounded-xl border border-dashed p-3',
        isOver && 'border-primary bg-primary/5',
      )}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-1 flex-col gap-2">
        {children}
        {emptyLabel ? (
          <p className="text-xs text-muted-foreground">{emptyLabel}</p>
        ) : null}
      </div>
    </div>
  )
}

export function SchoolClassesBoard({ schoolId }: { schoolId: string }) {
  const { t } = useTranslation(['schools', 'common', 'classes'])
  const queryClient = useQueryClient()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const classesQuery = {
    ...convexQuery(api.schools.listSchoolClasses, { schoolId }),
    gcTime: ONE_HOUR,
  }
  const treeQuery = {
    ...convexQuery(api.tenants.listTeamsAsTree, { organizationId: schoolId }),
    gcTime: ONE_HOUR,
  }
  const membersQuery = {
    ...convexQuery(api.schools.listSchoolMembers, { schoolId }),
    gcTime: ONE_HOUR,
  }
  const studentsQuery = {
    ...convexQuery(api.students.listOrgStudents, {
      schoolId,
      paginationOpts: { numItems: 200, cursor: null },
    }),
    gcTime: ONE_HOUR,
  }

  const { data: classes } = useQuery(classesQuery)
  const { data: tree } = useQuery(treeQuery)
  const { data: members } = useQuery(membersQuery)
  const { data: studentsPage } = useQuery(studentsQuery)

  const [selectedClassId, setSelectedClassId] = useState<Id<'classes'> | null>(
    null,
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [addStudentOpen, setAddStudentOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [activeDrag, setActiveDrag] = useState<DragPayload | null>(null)

  const staffQuery = {
    ...convexQuery(
      api.schools.listClassStaff,
      selectedClassId ? { classId: selectedClassId } : 'skip',
    ),
    gcTime: ONE_HOUR,
  }
  const rosterQuery = {
    ...convexQuery(
      api.students.listClassRoster,
      selectedClassId ? { classId: selectedClassId } : 'skip',
    ),
    gcTime: ONE_HOUR,
  }
  const { data: classStaff } = useQuery(staffQuery)
  const { data: roster } = useQuery(rosterQuery)

  const assignClassToTeam = useAssignClassToTeam(schoolId)
  const assignClassStaff = useAssignClassStaff(selectedClassId)
  const removeClassStaff = useRemoveClassStaff(selectedClassId)
  const enrollStudent = useEnrollStudent(selectedClassId)
  const unenrollStudent = useUnenrollStudent(selectedClassId)
  const createOrgStudent = useCreateOrgStudent(schoolId)

  const teams = useMemo(
    () => flattenTeams((tree as Array<TeamNode> | undefined) ?? []),
    [tree],
  )

  const classesByTeam = useMemo(() => {
    const map = new Map<string, Array<SchoolClass>>()
    map.set('unassigned', [])
    for (const team of teams) map.set(team.id, [])
    for (const cls of classes ?? []) {
      const key = cls.teamId ?? 'unassigned'
      const bucket = map.get(key) ?? map.get('unassigned')!
      if (!map.has(key)) {
        map.get('unassigned')!.push(cls)
      } else {
        bucket.push(cls)
      }
    }
    return map
  }, [classes, teams])

  const assignedStaffIds = useMemo(() => {
    return new Set((classStaff ?? []).map((s) => s.userId))
  }, [classStaff])

  const enrolledStudentIds = useMemo(() => {
    return new Set((roster?.students ?? []).map((s) => s.orgStudentId))
  }, [roster])

  const staffPool = ((members as Array<StaffMember> | undefined) ?? []).filter(
    (m) => !assignedStaffIds.has(m.userId as Id<'users'>),
  )
  const studentPool = (
    (studentsPage?.page as Array<OrgStudent> | undefined) ?? []
  ).filter((s) => !enrolledStudentIds.has(s._id))

  const selectedClass = (classes ?? []).find((c) => c._id === selectedClassId)

  const invalidateBoard = () => {
    void queryClient.invalidateQueries({ queryKey: classesQuery.queryKey })
    if (selectedClassId) {
      void queryClient.invalidateQueries({ queryKey: staffQuery.queryKey })
      void queryClient.invalidateQueries({ queryKey: rosterQuery.queryKey })
    }
    void queryClient.invalidateQueries({ queryKey: studentsQuery.queryKey })
  }

  const onDragStart = (event: DragStartEvent) => {
    setActiveDrag(event.active.data.current as DragPayload)
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null)
    const payload = event.active.data.current as DragPayload | undefined
    const overId = event.over?.id
    if (!payload || typeof overId !== 'string') return

    if (payload.kind === 'class' && overId.startsWith('team:')) {
      const teamId =
        overId === 'team:unassigned' ? null : overId.slice('team:'.length)
      void assignClassToTeam({ classId: payload.classId, teamId })
        .then(() => {
          toast.success(
            teamId ? t('classAssignedToTeam') : t('classUnassigned'),
          )
          invalidateBoard()
        })
        .catch((error: unknown) => {
          toast.error(
            error instanceof Error ? error.message : t('assignFailed'),
          )
        })
      return
    }

    if (!selectedClassId) return

    if (payload.kind === 'staff' && overId === 'lane:teachers') {
      void assignClassStaff({
        classId: selectedClassId,
        userId: payload.userId,
        role: 'classTeacher',
      })
        .then(() => {
          toast.success(t('staffAssigned'))
          invalidateBoard()
        })
        .catch((error: unknown) => {
          toast.error(
            error instanceof Error ? error.message : t('assignFailed'),
          )
        })
      return
    }

    if (payload.kind === 'staff' && overId === 'lane:assistants') {
      void assignClassStaff({
        classId: selectedClassId,
        userId: payload.userId,
        role: 'assistantTeacher',
      })
        .then(() => {
          toast.success(t('staffAssigned'))
          invalidateBoard()
        })
        .catch((error: unknown) => {
          toast.error(
            error instanceof Error ? error.message : t('assignFailed'),
          )
        })
      return
    }

    if (payload.kind === 'staff' && overId === 'pool:staff') {
      const current = classStaff?.find((s) => s.userId === payload.userId)
      if (!current) return
      void removeClassStaff({
        classId: selectedClassId,
        userId: payload.userId,
        role: current.role,
      })
        .then(() => {
          toast.success(t('staffRemoved'))
          invalidateBoard()
        })
        .catch((error: unknown) => {
          toast.error(
            error instanceof Error ? error.message : t('assignFailed'),
          )
        })
      return
    }

    if (payload.kind === 'student' && overId === 'lane:students') {
      void enrollStudent({
        classId: selectedClassId,
        orgStudentId: payload.orgStudentId,
      })
        .then(() => {
          toast.success(t('studentEnrolled'))
          invalidateBoard()
        })
        .catch((error: unknown) => {
          toast.error(
            error instanceof Error ? error.message : t('assignFailed'),
          )
        })
      return
    }

    if (payload.kind === 'student' && overId === 'pool:students') {
      void unenrollStudent({
        classId: selectedClassId,
        orgStudentId: payload.orgStudentId,
      })
        .then(() => {
          toast.success(t('studentUnenrolled'))
          invalidateBoard()
        })
        .catch((error: unknown) => {
          toast.error(
            error instanceof Error ? error.message : t('assignFailed'),
          )
        })
    }
  }

  const handleAddStudent = () => {
    const fn = firstName.trim()
    const ln = lastName.trim()
    if (!fn || !ln) return
    void createOrgStudent({ schoolId, firstName: fn, lastName: ln })
      .then(() => {
        toast.success(t('studentCreated'))
        setAddStudentOpen(false)
        setFirstName('')
        setLastName('')
        void queryClient.invalidateQueries({ queryKey: studentsQuery.queryKey })
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : t('studentCreateFailed'),
        )
      })
  }

  const teachers = (classStaff ?? []).filter((s) => s.role === 'classTeacher')
  const assistants = (classStaff ?? []).filter(
    (s) => s.role === 'assistantTeacher',
  )
  const enrolled = (roster?.students as Array<RosterStudent> | undefined) ?? []

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {t('classesTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('classesDescription')}
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus />
          {t('createClass')}
        </Button>
      </div>

      <ClassFormCredenza
        open={createOpen}
        onOpenChange={setCreateOpen}
        organizationId={schoolId}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DropLane id="team:unassigned" title={t('unassignedTeam')}>
            {classes === undefined ? (
              <Skeleton className="h-10 w-full" />
            ) : (classesByTeam.get('unassigned') ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t('noSchoolClassesYet')}
              </p>
            ) : (
              (classesByTeam.get('unassigned') ?? []).map((cls) => (
                <ClassChip
                  key={cls._id}
                  cls={cls}
                  selected={selectedClassId === cls._id}
                  onSelect={() => setSelectedClassId(cls._id)}
                  forceHidden={
                    activeDrag?.kind === 'class' &&
                    activeDrag.classId === cls._id
                  }
                />
              ))
            )}
          </DropLane>
          {teams.map((team) => (
            <DropLane
              key={team.id}
              id={`team:${team.id}`}
              title={`${'· '.repeat(team.depth)}${team.name}`}
            >
              {(classesByTeam.get(team.id) ?? []).map((cls) => (
                <ClassChip
                  key={cls._id}
                  cls={cls}
                  selected={selectedClassId === cls._id}
                  onSelect={() => setSelectedClassId(cls._id)}
                  forceHidden={
                    activeDrag?.kind === 'class' &&
                    activeDrag.classId === cls._id
                  }
                />
              ))}
            </DropLane>
          ))}
        </div>

        <div className="rounded-xl border p-4">
          {selectedClass ? (
            <div className="space-y-4">
              <h3 className="font-semibold">{selectedClass.name}</h3>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium">{t('staffPool')}</h4>
                  </div>
                  <DropLane id="pool:staff" title={t('staffPool')}>
                    {staffPool.map((member) => (
                      <PersonChip
                        key={member.userId}
                        id={`staff:${member.userId}`}
                        label={member.name || member.email || member.userId}
                        dragData={{
                          kind: 'staff',
                          userId: member.userId as Id<'users'>,
                        }}
                        badge={
                          <OrgRoleBadge
                            role={
                              member.role as
                                | 'owner'
                                | 'admin'
                                | 'principal'
                                | 'teacher'
                                | 'member'
                            }
                            iconOnly
                          />
                        }
                      />
                    ))}
                  </DropLane>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium">{t('studentPool')}</h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAddStudentOpen(true)}
                    >
                      <Plus />
                      {t('addStudent')}
                    </Button>
                  </div>
                  <DropLane id="pool:students" title={t('studentPool')}>
                    {studentPool.map((student) => (
                      <PersonChip
                        key={student._id}
                        id={`student:${student._id}`}
                        label={student.displayName}
                        dragData={{
                          kind: 'student',
                          orgStudentId: student._id,
                        }}
                      />
                    ))}
                  </DropLane>
                </div>
                <div className="space-y-3">
                  <DropLane id="lane:teachers" title={t('classTeachersLane')}>
                    {teachers.map((member) => (
                      <PersonChip
                        key={member.userId}
                        id={`staff:${member.userId}`}
                        label={member.name || member.email || member.userId}
                        dragData={{
                          kind: 'staff',
                          userId: member.userId,
                        }}
                      />
                    ))}
                  </DropLane>
                  <DropLane
                    id="lane:assistants"
                    title={t('classAssistantsLane')}
                  >
                    {assistants.map((member) => (
                      <PersonChip
                        key={member.userId}
                        id={`staff:${member.userId}`}
                        label={member.name || member.email || member.userId}
                        dragData={{
                          kind: 'staff',
                          userId: member.userId,
                        }}
                      />
                    ))}
                  </DropLane>
                  <DropLane id="lane:students" title={t('classStudentsLane')}>
                    {enrolled.map((student) => (
                      <PersonChip
                        key={student.orgStudentId}
                        id={`student:${student.orgStudentId}`}
                        label={student.displayName}
                        dragData={{
                          kind: 'student',
                          orgStudentId: student.orgStudentId,
                        }}
                      />
                    ))}
                  </DropLane>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('selectClassHint')}
            </p>
          )}
        </div>

        <DragOverlay>
          {activeDrag?.kind === 'class' ? (
            <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-md">
              {(classes ?? []).find((c) => c._id === activeDrag.classId)?.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Credenza open={addStudentOpen} onOpenChange={setAddStudentOpen}>
        <CredenzaContent>
          <CredenzaHeader>
            <CredenzaTitle>{t('addStudentTitle')}</CredenzaTitle>
          </CredenzaHeader>
          <CredenzaBody>
            <FieldGroup>
              <Field>
                <FieldLabel>{t('firstNameLabel')}</FieldLabel>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>{t('lastNameLabel')}</FieldLabel>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </Field>
            </FieldGroup>
          </CredenzaBody>
          <CredenzaFooter>
            <CredenzaClose asChild>
              <Button type="button" variant="outline">
                {t('common:cancel')}
              </Button>
            </CredenzaClose>
            <Button type="button" onClick={handleAddStudent}>
              {t('addStudent')}
            </Button>
          </CredenzaFooter>
        </CredenzaContent>
      </Credenza>
    </section>
  )
}
