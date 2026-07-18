import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation } from 'convex/react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Copy,
  Download,
  GripVertical,
  Link2,
  Pencil,
  RefreshCw,
  UserMinus,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import {
  useUpdateEnrollmentDisplay,
  useUpdateStudentProfile,
} from '@/lib/students'
import { useUnlinkGuardian } from '@/lib/guardians'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatJoinCodeDisplay, getJoinUrl } from '@/lib/joinCode'
import { cn } from '@/lib/utils'

function findScrollAreaViewport(root: HTMLElement | null) {
  if (!root) return null
  return (
    root.querySelector<HTMLDivElement>('[data-slot="scroll-area-viewport"]') ??
    root.querySelector<HTMLDivElement>('[data-radix-scroll-area-viewport]')
  )
}

type RosterStudent = {
  enrollmentId: Id<'classEnrollments'>
  orgStudentId: Id<'orgStudents'>
  rosterNumber: number
  firstName: string
  lastName: string
  gender?:
    | 'male'
    | 'female'
    | 'nonBinary'
    | 'transgender'
    | 'agender'
    | 'genderfluid'
    | 'unspecified'
  pronouns?:
    | 'sheHer'
    | 'heHim'
    | 'theyThem'
    | 'itIts'
    | 'perPers'
    | 'zeHir'
    | 'xeXem'
    | 'nameOnly'
    | 'unspecified'
  email?: string
  rosterFirstName?: string
  rosterLastName?: string
  displayName: string
  guardianCode: string
  guardians: Array<{
    guardianUserId: Id<'users'>
    name?: string
    email?: string
    linkedAt: number
  }>
}

type PdfRoster = {
  className: string
  year: number
  organizationId?: string
  students: Array<{
    orgStudentId: Id<'orgStudents'>
    displayName: string
    guardianCode: string
    guardians: Array<{
      guardianUserId: Id<'users'>
      name?: string
      email?: string
      linkedAt: number
    }>
  }>
}

type PendingUnlink =
  | {
      kind: 'one'
      orgStudentId: Id<'orgStudents'>
      studentName: string
      guardianUserId: Id<'users'>
      guardianName: string
    }
  | {
      kind: 'all'
      orgStudentId: Id<'orgStudents'>
      studentName: string
      guardianCount: number
    }

type SortKey =
  | 'rosterNumber'
  | 'lastName'
  | 'firstName'
  | 'gender'
  | 'pronouns'
  | 'email'
  | 'rosterLastName'
  | 'rosterFirstName'
  | 'guardians'
  | 'guardianCode'

const GENDER_VALUES = [
  'male',
  'female',
  'nonBinary',
  'transgender',
  'agender',
  'genderfluid',
  'unspecified',
] as const

const PRONOUN_VALUES = [
  'sheHer',
  'heHim',
  'theyThem',
  'itIts',
  'perPers',
  'zeHir',
  'xeXem',
  'nameOnly',
  'unspecified',
] as const

const COLUMN_COUNT = 11
const ROW_ESTIMATE = 52

function SortButton({
  sorted,
  children,
  onClick,
}: {
  sorted: false | 'asc' | 'desc'
  children: ReactNode
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2 h-8 gap-1 px-2"
      onClick={onClick}
    >
      {children}
      {sorted === 'asc' ? (
        <ArrowUp className="size-3.5" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="size-3.5" />
      ) : (
        <ArrowUpDown className="size-3.5 opacity-50" />
      )}
    </Button>
  )
}

function EditableTextCell({
  value,
  onSave,
  placeholder,
  className,
}: {
  value: string
  onSave: (next: string) => Promise<void>
  placeholder?: string
  className?: string
}) {
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  return (
    <Input
      value={draft}
      disabled={saving}
      placeholder={placeholder}
      className={cn('h-8 min-w-28', className)}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={() => setDraft(value)}
      onBlur={() => {
        if (draft === value) return
        setSaving(true)
        void onSave(draft).finally(() => setSaving(false))
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          setDraft(value)
          event.currentTarget.blur()
        }
      }}
    />
  )
}

function SortableRosterRow({
  student,
  isEditing,
  index,
  measureRef,
  editLabel,
  doneLabel,
  onStartEdit,
  onDoneEdit,
  children,
}: {
  student: RosterStudent
  isEditing: boolean
  index: number
  measureRef: (node: Element | null) => void
  editLabel: string
  doneLabel: string
  onStartEdit: () => void
  onDoneEdit: () => void
  children: ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: student.enrollmentId, disabled: isEditing })

  const setRefs = (node: HTMLTableRowElement | null) => {
    setNodeRef(node)
    measureRef(node)
  }

  return (
    <TableRow
      ref={setRefs}
      data-index={index}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(isDragging && 'relative z-10 bg-background opacity-90')}
      data-dragging={isDragging || undefined}
    >
      <TableCell className="w-20 px-1">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="inline-flex size-8 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Reorder"
            disabled={isEditing}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
          {isEditing ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={doneLabel}
              onClick={onDoneEdit}
            >
              <Check className="size-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={editLabel}
              onClick={onStartEdit}
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
        </div>
      </TableCell>
      {children}
    </TableRow>
  )
}

export function ClassStudentsSection({
  classId,
  pdfData,
}: {
  classId: Id<'classes'>
  pdfData: PdfRoster | undefined
}) {
  const { t } = useTranslation(['classes', 'common'])
  const { data: roster } = useQuery({
    ...convexQuery(api.students.listClassRoster, { classId }),
    gcTime: ONE_HOUR,
  })
  const updateStudentProfile = useUpdateStudentProfile()
  const updateEnrollmentDisplay = useUpdateEnrollmentDisplay()
  const reorderRoster = useMutation(api.students.reorderRoster)
  const unlinkGuardian = useUnlinkGuardian()
  const unlinkAllGuardiansForStudent = useMutation(
    api.guardians.unlinkAllGuardiansForStudent,
  )
  const regenerateGuardianCode = useMutation(
    api.guardians.regenerateGuardianCode,
  )

  const [orderOverride, setOrderOverride] = useState<Array<
    Id<'classEnrollments'>
  > | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('rosterNumber')
  const [sortDesc, setSortDesc] = useState(false)
  const [editingEnrollmentId, setEditingEnrollmentId] = useState<
    Id<'classEnrollments'> | null
  >(null)
  const [activeDragId, setActiveDragId] = useState<Id<'classEnrollments'> | null>(
    null,
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [pendingUnlink, setPendingUnlink] = useState<PendingUnlink | null>(null)
  const [regeneratingStudentId, setRegeneratingStudentId] =
    useState<Id<'orgStudents'> | null>(null)

  const scrollAreaRootRef = useRef<HTMLDivElement>(null)
  const [scrollViewportEl, setScrollViewportEl] =
    useState<HTMLDivElement | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const genderLabel = (value: (typeof GENDER_VALUES)[number]) => {
    switch (value) {
      case 'male':
        return t('genderMale')
      case 'female':
        return t('genderFemale')
      case 'nonBinary':
        return t('genderNonBinary')
      case 'transgender':
        return t('genderTransgender')
      case 'agender':
        return t('genderAgender')
      case 'genderfluid':
        return t('genderGenderfluid')
      case 'unspecified':
        return t('genderUnspecified')
    }
  }

  const pronounLabel = (value: (typeof PRONOUN_VALUES)[number]) => {
    switch (value) {
      case 'sheHer':
        return t('pronounsSheHer')
      case 'heHim':
        return t('pronounsHeHim')
      case 'theyThem':
        return t('pronounsTheyThem')
      case 'itIts':
        return t('pronounsItIts')
      case 'perPers':
        return t('pronounsPerPers')
      case 'zeHir':
        return t('pronounsZeHir')
      case 'xeXem':
        return t('pronounsXeXem')
      case 'nameOnly':
        return t('pronounsNameOnly')
      case 'unspecified':
        return t('pronounsUnspecified')
    }
  }

  const serverStudents = roster?.students

  const displayRows = useMemo(() => {
    if (!serverStudents) return []

    if (orderOverride) {
      const byId = new Map(
        serverStudents.map((student) => [student.enrollmentId, student]),
      )
      const ordered = orderOverride
        .map((id) => byId.get(id))
        .filter((student): student is RosterStudent => student !== undefined)
      for (const student of serverStudents) {
        if (!orderOverride.includes(student.enrollmentId)) {
          ordered.push(student)
        }
      }
      return ordered.map((student, index) => ({
        ...student,
        rosterNumber: index + 1,
      }))
    }

    const ordered = [...serverStudents]
    const direction = sortDesc ? -1 : 1
    const compareText = (left: string, right: string) =>
      left.localeCompare(right) * direction

    ordered.sort((left, right) => {
      switch (sortKey) {
        case 'rosterNumber':
          return (left.rosterNumber - right.rosterNumber) * direction
        case 'lastName':
          return compareText(left.lastName, right.lastName)
        case 'firstName':
          return compareText(left.firstName, right.firstName)
        case 'gender':
          return compareText(left.gender ?? '', right.gender ?? '')
        case 'pronouns':
          return compareText(left.pronouns ?? '', right.pronouns ?? '')
        case 'email':
          return compareText(left.email ?? '', right.email ?? '')
        case 'rosterLastName':
          return compareText(
            left.rosterLastName ?? '',
            right.rosterLastName ?? '',
          )
        case 'rosterFirstName':
          return compareText(
            left.rosterFirstName ?? '',
            right.rosterFirstName ?? '',
          )
        case 'guardians':
          return compareText(
            left.guardians.map((g) => g.name ?? g.email ?? '').join(', '),
            right.guardians.map((g) => g.name ?? g.email ?? '').join(', '),
          )
        case 'guardianCode':
          return compareText(left.guardianCode, right.guardianCode)
        default:
          return 0
      }
    })

    return ordered
  }, [serverStudents, orderOverride, sortKey, sortDesc])

  const rowVirtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => scrollViewportEl,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 10,
    measureElement:
      typeof window !== 'undefined' &&
      navigator.userAgent.indexOf('Firefox') === -1
        ? (element) => element.getBoundingClientRect().height
        : undefined,
  })

  useEffect(() => {
    if (roster === undefined || displayRows.length === 0) {
      setScrollViewportEl(null)
      return
    }

    let raf = 0
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      const viewport = findScrollAreaViewport(scrollAreaRootRef.current)
      if (viewport) {
        setScrollViewportEl(viewport)
        return
      }
      raf = window.requestAnimationFrame(tick)
    }

    raf = window.requestAnimationFrame(tick)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(raf)
    }
  }, [roster, displayRows.length])

  useEffect(() => {
    if (!scrollViewportEl) return
    rowVirtualizer.measure()
  }, [scrollViewportEl, rowVirtualizer])

  const virtualItems = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualItems[0]?.start ?? 0
  const paddingBottom =
    rowVirtualizer.getTotalSize() -
    (virtualItems[virtualItems.length - 1]?.end ?? 0)

  useLayoutEffect(() => {
    rowVirtualizer.measure()
  }, [editingEnrollmentId, displayRows.length, rowVirtualizer])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc((prev) => !prev)
    } else {
      setSortKey(key)
      setSortDesc(false)
    }
    // Sorting by a non-roster column clears drag override so numbers match sort.
    if (key !== 'rosterNumber') {
      setOrderOverride(null)
    }
  }

  const sortState = (key: SortKey): false | 'asc' | 'desc' => {
    if (sortKey !== key) return false
    return sortDesc ? 'desc' : 'asc'
  }

  const saveProfile = async (
    student: RosterStudent,
    patch: Partial<{
      gender: RosterStudent['gender']
      pronouns: RosterStudent['pronouns']
    }>,
  ) => {
    try {
      await updateStudentProfile({
        classId,
        orgStudentId: student.orgStudentId,
        gender: patch.gender ?? student.gender,
        pronouns: patch.pronouns ?? student.pronouns,
      })
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : t('rosterSaveFailed'),
      )
      throw error
    }
  }

  const saveEnrollmentDisplay = async (
    student: RosterStudent,
    patch: Partial<{ rosterFirstName: string; rosterLastName: string }>,
  ) => {
    try {
      await updateEnrollmentDisplay({
        classId,
        enrollmentId: student.enrollmentId,
        rosterFirstName:
          patch.rosterFirstName !== undefined
            ? patch.rosterFirstName
            : student.rosterFirstName,
        rosterLastName:
          patch.rosterLastName !== undefined
            ? patch.rosterLastName
            : student.rosterLastName,
      })
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : t('rosterSaveFailed'),
      )
      throw error
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as Id<'classEnrollments'>)
    setEditingEnrollmentId(null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const currentIds = displayRows.map((row) => row.enrollmentId)
    const oldIndex = currentIds.indexOf(active.id as Id<'classEnrollments'>)
    const newIndex = currentIds.indexOf(over.id as Id<'classEnrollments'>)
    if (oldIndex < 0 || newIndex < 0) return

    const previousOverride = orderOverride
    const nextIds = arrayMove(currentIds, oldIndex, newIndex)
    setOrderOverride(nextIds)
    setSortKey('rosterNumber')
    setSortDesc(false)

    void reorderRoster({
      classId,
      enrollmentIds: nextIds,
    })
      .then(() => {
        setOrderOverride(null)
      })
      .catch((error: unknown) => {
        setOrderOverride(previousOverride)
        toast.error(
          error instanceof Error ? error.message : t('rosterReorderFailed'),
        )
      })
  }

  const handleDownload = async () => {
    if (!pdfData) return
    setIsGenerating(true)
    try {
      const { downloadGuardianCodesPdf } =
        await import('@/lib/guardianCodesPdf')
      await downloadGuardianCodesPdf(pdfData)
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('downloadGuardianCodePdfFailed'),
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyCode = (code: string, displayName: string) => {
    void navigator.clipboard
      .writeText(code)
      .then(() => toast.success(t('codeForCopied', { name: displayName })))
      .catch(() => toast.error(t('codeCopyFailed')))
  }

  const handleCopyLink = (code: string, displayName: string) => {
    void navigator.clipboard
      .writeText(getJoinUrl(code))
      .then(() => toast.success(t('linkForCopied', { name: displayName })))
      .catch(() => toast.error(t('linkCopyFailed')))
  }

  const handleRegenerate = (
    orgStudentId: Id<'orgStudents'>,
    displayName: string,
  ) => {
    setRegeneratingStudentId(orgStudentId)
    void regenerateGuardianCode({ orgStudentId, classId })
      .then((newCode) => {
        toast.success(t('guardianCodeRegenerated', { name: displayName }))
        void navigator.clipboard.writeText(newCode).catch(() => {
          /* clipboard optional */
        })
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : t('guardianCodeRegenerateFailed'),
        )
      })
      .finally(() => setRegeneratingStudentId(null))
  }

  const handleConfirmUnlink = () => {
    if (!pendingUnlink) return
    const unlinking = pendingUnlink
    setPendingUnlink(null)

    const mutationPromise =
      unlinking.kind === 'one'
        ? unlinkGuardian({
            classId,
            orgStudentId: unlinking.orgStudentId,
            guardianUserId: unlinking.guardianUserId,
          }).then(() => 1)
        : unlinkAllGuardiansForStudent({
            classId,
            orgStudentId: unlinking.orgStudentId,
          })

    void mutationPromise
      .then((removed) => {
        toast.success(
          unlinking.kind === 'one'
            ? t('guardianRemoved', { name: unlinking.guardianName })
            : t('guardiansRemoved', { count: removed }),
        )
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : unlinking.kind === 'one'
              ? t('removeGuardianFailed')
              : t('removeGuardiansFailed'),
        )
      })
  }

  const activeStudent = activeDragId
    ? displayRows.find((row) => row.enrollmentId === activeDragId)
    : null

  const dialogTitle =
    pendingUnlink?.kind === 'one'
      ? t('removeGuardianTitle')
      : t('removeAllGuardiansTitle')
  const dialogDescription =
    pendingUnlink?.kind === 'one'
      ? t('removeGuardianDescription', {
          guardian: pendingUnlink.guardianName,
          student: pendingUnlink.studentName,
        })
      : pendingUnlink
        ? t('removeAllGuardiansDescription', {
            count: pendingUnlink.guardianCount,
            student: pendingUnlink.studentName,
          })
        : ''

  const renderGuardianSummary = (student: RosterStudent) => {
    if (student.guardians.length === 0) {
      return (
        <span className="text-muted-foreground">{t('noGuardianLinked')}</span>
      )
    }
    return (
      <div className="flex min-w-40 flex-col gap-0.5 whitespace-normal text-sm">
        {student.guardians.map((guardian) => {
          const name =
            guardian.name ??
            t('common:userFallback', {
              id: guardian.guardianUserId.slice(-6),
            })
          return (
            <span key={guardian.guardianUserId}>
              <span className="font-medium">{name}</span>
              {guardian.email ? (
                <span className="text-muted-foreground">
                  {' '}
                  · {guardian.email}
                </span>
              ) : null}
            </span>
          )
        })}
      </div>
    )
  }

  const renderViewCells = (student: RosterStudent) => (
    <>
      <TableCell className="tabular-nums font-medium">
        {student.rosterNumber < Number.MAX_SAFE_INTEGER
          ? student.rosterNumber
          : '—'}
      </TableCell>
      <TableCell>{student.lastName || '—'}</TableCell>
      <TableCell>{student.firstName || '—'}</TableCell>
      <TableCell>
        {genderLabel(student.gender ?? 'unspecified')}
      </TableCell>
      <TableCell>
        {pronounLabel(student.pronouns ?? 'unspecified')}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {student.email || '—'}
      </TableCell>
      <TableCell>{student.rosterLastName || '—'}</TableCell>
      <TableCell>{student.rosterFirstName || '—'}</TableCell>
      <TableCell>{renderGuardianSummary(student)}</TableCell>
      <TableCell>
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {formatJoinCodeDisplay(student.guardianCode)}
        </code>
      </TableCell>
    </>
  )

  const renderEditCells = (student: RosterStudent) => (
    <>
      <TableCell className="tabular-nums font-medium">
        {student.rosterNumber < Number.MAX_SAFE_INTEGER
          ? student.rosterNumber
          : '—'}
      </TableCell>
      <TableCell>{student.lastName || '—'}</TableCell>
      <TableCell>{student.firstName || '—'}</TableCell>
      <TableCell>
        <Select
          value={student.gender ?? 'unspecified'}
          onValueChange={(value) => {
            void saveProfile(student, {
              gender: value as RosterStudent['gender'],
            })
          }}
        >
          <SelectTrigger size="sm" className="min-w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GENDER_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {genderLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={student.pronouns ?? 'unspecified'}
          onValueChange={(value) => {
            void saveProfile(student, {
              pronouns: value as RosterStudent['pronouns'],
            })
          }}
        >
          <SelectTrigger size="sm" className="min-w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRONOUN_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {pronounLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {student.email || '—'}
      </TableCell>
      <TableCell>
        <EditableTextCell
          value={student.rosterLastName ?? ''}
          placeholder={student.lastName}
          onSave={(rosterLastName) =>
            saveEnrollmentDisplay(student, { rosterLastName })
          }
        />
      </TableCell>
      <TableCell>
        <EditableTextCell
          value={student.rosterFirstName ?? ''}
          placeholder={student.firstName}
          onSave={(rosterFirstName) =>
            saveEnrollmentDisplay(student, { rosterFirstName })
          }
        />
      </TableCell>
      <TableCell>
        <div className="flex min-w-48 flex-col gap-1 whitespace-normal">
          {student.guardians.length === 0 ? (
            <span className="text-muted-foreground">{t('noGuardianLinked')}</span>
          ) : (
            student.guardians.map((guardian) => {
              const name =
                guardian.name ??
                t('common:userFallback', {
                  id: guardian.guardianUserId.slice(-6),
                })
              return (
                <div key={guardian.guardianUserId} className="text-sm">
                  <span className="font-medium">{name}</span>
                  {guardian.email ? (
                    <span className="text-muted-foreground">
                      {' '}
                      · {guardian.email}
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="ml-1"
                    aria-label={t('removeGuardianTitle')}
                    onClick={() =>
                      setPendingUnlink({
                        kind: 'one',
                        orgStudentId: student.orgStudentId,
                        studentName: student.displayName,
                        guardianUserId: guardian.guardianUserId,
                        guardianName: name,
                      })
                    }
                  >
                    <UserMinus className="size-3.5" />
                  </Button>
                </div>
              )
            })
          )}
          {student.guardians.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-7 justify-start px-1 text-xs"
              onClick={() =>
                setPendingUnlink({
                  kind: 'all',
                  orgStudentId: student.orgStudentId,
                  studentName: student.displayName,
                  guardianCount: student.guardians.length,
                })
              }
            >
              {t('removeAllGuardians')}
            </Button>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            {formatJoinCodeDisplay(student.guardianCode)}
          </code>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t('copyCodeFor', { name: student.displayName })}
            onClick={() =>
              handleCopyCode(student.guardianCode, student.displayName)
            }
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t('copyLinkFor', { name: student.displayName })}
            onClick={() =>
              handleCopyLink(student.guardianCode, student.displayName)
            }
          >
            <Link2 className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={regeneratingStudentId === student.orgStudentId}
            aria-label={t('regenerateGuardianFor', {
              name: student.displayName,
            })}
            onClick={() =>
              handleRegenerate(student.orgStudentId, student.displayName)
            }
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      </TableCell>
    </>
  )

  return (
    <>
      <section className="min-w-0 w-full">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">
              {t('students')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('studentsDescription')}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="default"
            className="w-full shrink-0 sm:w-auto"
            aria-label={t('downloadGuardianCodePdfAria')}
            disabled={pdfData === undefined || isGenerating}
            onClick={() => void handleDownload()}
          >
            <Download /> {t('downloadGuardianCodePdf')}
          </Button>
        </div>

        {roster === undefined ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : displayRows.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {t('noStudentsYet')}
          </div>
        ) : (
          <div className="mt-4 min-w-0 overflow-hidden rounded-lg border">
            <ScrollArea
              ref={scrollAreaRootRef}
              className="h-[min(70vh,calc(100dvh-12rem))]"
            >
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={displayRows.map((row) => row.enrollmentId)}
                  strategy={verticalListSortingStrategy}
                >
                  <Table
                    containerClassName="overflow-visible"
                    className="w-max min-w-full"
                  >
                    <TableHeader className="sticky top-0 z-20 bg-background">
                      <TableRow>
                        <TableHead className="w-20 px-1" />
                        <TableHead>
                          <SortButton
                            sorted={sortState('rosterNumber')}
                            onClick={() => toggleSort('rosterNumber')}
                          >
                            {t('colRosterNumber')}
                          </SortButton>
                        </TableHead>
                        <TableHead>
                          <SortButton
                            sorted={sortState('lastName')}
                            onClick={() => toggleSort('lastName')}
                          >
                            {t('colLastName')}
                          </SortButton>
                        </TableHead>
                        <TableHead>
                          <SortButton
                            sorted={sortState('firstName')}
                            onClick={() => toggleSort('firstName')}
                          >
                            {t('colFirstName')}
                          </SortButton>
                        </TableHead>
                        <TableHead>
                          <SortButton
                            sorted={sortState('gender')}
                            onClick={() => toggleSort('gender')}
                          >
                            {t('colGender')}
                          </SortButton>
                        </TableHead>
                        <TableHead>
                          <SortButton
                            sorted={sortState('pronouns')}
                            onClick={() => toggleSort('pronouns')}
                          >
                            {t('colPronouns')}
                          </SortButton>
                        </TableHead>
                        <TableHead>
                          <SortButton
                            sorted={sortState('email')}
                            onClick={() => toggleSort('email')}
                          >
                            {t('colEmail')}
                          </SortButton>
                        </TableHead>
                        <TableHead>
                          <SortButton
                            sorted={sortState('rosterLastName')}
                            onClick={() => toggleSort('rosterLastName')}
                          >
                            {t('colRosterLastName')}
                          </SortButton>
                        </TableHead>
                        <TableHead>
                          <SortButton
                            sorted={sortState('rosterFirstName')}
                            onClick={() => toggleSort('rosterFirstName')}
                          >
                            {t('colRosterFirstName')}
                          </SortButton>
                        </TableHead>
                        <TableHead>
                          <SortButton
                            sorted={sortState('guardians')}
                            onClick={() => toggleSort('guardians')}
                          >
                            {t('colGuardians')}
                          </SortButton>
                        </TableHead>
                        <TableHead>
                          <SortButton
                            sorted={sortState('guardianCode')}
                            onClick={() => toggleSort('guardianCode')}
                          >
                            {t('colGuardianCode')}
                          </SortButton>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paddingTop > 0 ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell
                            colSpan={COLUMN_COUNT}
                            className="p-0"
                            style={{ height: paddingTop }}
                          />
                        </TableRow>
                      ) : null}
                      {virtualItems.map((virtualRow) => {
                        const student = displayRows[virtualRow.index]
                        const isEditing =
                          editingEnrollmentId === student.enrollmentId
                        return (
                          <SortableRosterRow
                            key={student.enrollmentId}
                            student={student}
                            isEditing={isEditing}
                            index={virtualRow.index}
                            measureRef={rowVirtualizer.measureElement}
                            editLabel={t('edit')}
                            doneLabel={t('common:save')}
                            onStartEdit={() =>
                              setEditingEnrollmentId(student.enrollmentId)
                            }
                            onDoneEdit={() => setEditingEnrollmentId(null)}
                          >
                            {isEditing
                              ? renderEditCells(student)
                              : renderViewCells(student)}
                          </SortableRosterRow>
                        )
                      })}
                      {paddingBottom > 0 ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell
                            colSpan={COLUMN_COUNT}
                            className="p-0"
                            style={{ height: paddingBottom }}
                          />
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </SortableContext>
                <DragOverlay dropAnimation={null}>
                  {activeStudent ? (
                    <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
                      #{activeStudent.rosterNumber} {activeStudent.displayName}
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}
      </section>

      <AlertDialog
        open={pendingUnlink !== null}
        onOpenChange={(open) => {
          if (!open) setPendingUnlink(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUnlink}>
              {t('common:remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
