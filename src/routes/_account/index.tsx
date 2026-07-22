import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useConvexAuth } from '@convex-dev/auth/react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  LayoutGrid,
  List,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import i18n from '#/i18n'
import { ClassList } from '#/components/classes/ClassList'
import type { ClassListView } from '#/components/classes/ClassList'
import { ClassFormCredenza } from '#/components/classes/ClassFormCredenza'
import { LinkedStudentsSection } from '#/components/classes/LinkedStudentsSection'
import { SchoolList } from '#/components/schools/SchoolList'
import { SchoolFormCredenza } from '#/components/schools/SchoolFormCredenza'
import { translateClassRole } from '#/i18n/roleLabels'
import {
  DEFAULT_CLASS_SORT,
  getSortDirection,
  getSortField,
  isClassSortField,
  selectClassSortField,
  toggleClassSort,
} from '#/lib/classSort'
import type { ClassSort, ClassSortField } from '#/lib/classSort'
import type { ClassDisplayRole, ClassPublic } from '#/lib/classes'
import {
  DEFAULT_HOME_SECTION_ORDER,
  SCHOOL_ORG_ROLES,
  isSchoolArchived,
  useSetHomeSectionOrder,
} from '#/lib/schools'
import type { HomeSectionId, SchoolOrgRole, SchoolPublic } from '#/lib/schools'
import { ONE_HOUR } from '#/lib/queryCache'
import { api } from '../../../convex/_generated/api'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_account/')({
  component: Home,
  head: () => ({
    meta: [
      {
        name: 'description',
        content: i18n.t('home:docDescription'),
      },
      {
        title: i18n.t('home:docTitle'),
      },
    ],
  }),
})

type FormMode = 'create' | 'edit'
type ClassRoleFilter = 'all' | ClassDisplayRole
type SchoolRoleFilter = 'all' | SchoolOrgRole

const CLASS_ROLE_FILTER_OPTIONS = [
  'creator',
  'classTeacher',
  'assistantTeacher',
  'student',
  'guardian',
] as const satisfies ReadonlyArray<ClassDisplayRole>

function isClassRoleFilter(value: string): value is ClassRoleFilter {
  return (
    value === 'all' ||
    (CLASS_ROLE_FILTER_OPTIONS as ReadonlyArray<string>).includes(value)
  )
}

function isSchoolRoleFilter(value: string): value is SchoolRoleFilter {
  return (
    value === 'all' ||
    (SCHOOL_ORG_ROLES as ReadonlyArray<string>).includes(value)
  )
}

function SortViewControls({
  sort,
  setSort,
  view,
  setView,
  sortAriaLabel,
  viewAriaLabel,
}: {
  sort: ClassSort
  setSort: (updater: (current: ClassSort) => ClassSort) => void
  view: ClassListView
  setView: (view: ClassListView) => void
  sortAriaLabel: string
  viewAriaLabel: string
}) {
  const { t } = useTranslation('home')
  const activeSortField = getSortField(sort)
  const activeSortDirection = getSortDirection(sort)
  const SortDirectionIcon = activeSortDirection === 'asc' ? ArrowUp : ArrowDown
  const sortFieldLabels: Record<ClassSortField, string> = {
    name: t('sortByName'),
    created: t('sortByCreated'),
    updated: t('sortByUpdated'),
  }

  return (
    <>
      <ToggleGroup
        type="single"
        value={activeSortField}
        onValueChange={(value) => {
          if (value === '') {
            setSort((current) => toggleClassSort(current))
            return
          }
          if (isClassSortField(value)) {
            setSort((current) => selectClassSortField(current, value))
          }
        }}
        variant="outline"
        spacing={0}
        aria-label={sortAriaLabel}
      >
        {(['name', 'created', 'updated'] as const).map((field) => {
          const isActive = field === activeSortField
          const fieldLabel = sortFieldLabels[field]
          return (
            <ToggleGroupItem
              key={field}
              value={field}
              aria-label={
                isActive
                  ? t('sortByFieldActive', {
                      field: fieldLabel,
                      direction:
                        activeSortDirection === 'asc'
                          ? t('sortAscending')
                          : t('sortDescending'),
                    })
                  : t('sortByField', { field: fieldLabel })
              }
            >
              {fieldLabel}
              {isActive ? <SortDirectionIcon data-icon="inline-end" /> : null}
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(value) => {
          if (value === 'grid' || value === 'list') {
            setView(value)
          }
        }}
        variant="outline"
        spacing={0}
        aria-label={viewAriaLabel}
      >
        <ToggleGroupItem value="grid" aria-label={t('viewGrid')}>
          <LayoutGrid />
        </ToggleGroupItem>
        <ToggleGroupItem value="list" aria-label={t('viewList')}>
          <List />
        </ToggleGroupItem>
      </ToggleGroup>
    </>
  )
}

function SortableHomeSection({
  id,
  children,
}: {
  id: HomeSectionId
  children: React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })
  const { t } = useTranslation('home')

  return (
    <section
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(isDragging && 'opacity-80')}
    >
      <div className="mb-4 flex items-start gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="mt-1 shrink-0 cursor-grab touch-none active:cursor-grabbing"
          aria-label={t('reorderSection')}
          {...attributes}
          {...listeners}
        >
          <GripVertical />
        </Button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </section>
  )
}

function Home() {
  const { t } = useTranslation(['home', 'schools'])
  const { t: tClasses } = useTranslation('classes')
  const { t: tSchools } = useTranslation('schools')
  const { isAuthenticated } = useConvexAuth()

  const [classFormOpen, setClassFormOpen] = useState(false)
  const [classFormMode, setClassFormMode] = useState<FormMode>('create')
  const [editingClass, setEditingClass] = useState<ClassPublic | null>(null)
  const [schoolFormOpen, setSchoolFormOpen] = useState(false)
  const [schoolFormMode, setSchoolFormMode] = useState<FormMode>('create')
  const [editingSchool, setEditingSchool] = useState<SchoolPublic | null>(null)

  const [classView, setClassView] = useState<ClassListView>('grid')
  const [classSort, setClassSort] = useState<ClassSort>(DEFAULT_CLASS_SORT)
  const [classRoleFilter, setClassRoleFilter] = useState<ClassRoleFilter>('all')

  const [schoolView, setSchoolView] = useState<ClassListView>('grid')
  const [schoolSort, setSchoolSort] = useState<ClassSort>(DEFAULT_CLASS_SORT)
  const [schoolRoleFilter, setSchoolRoleFilter] =
    useState<SchoolRoleFilter>('all')

  const [sectionOrder, setSectionOrder] = useState<Array<HomeSectionId>>([
    ...DEFAULT_HOME_SECTION_ORDER,
  ])

  const editFrameRef = useRef<number | null>(null)
  const setHomeSectionOrder = useSetHomeSectionOrder()

  const { data: accountHome } = useQuery({
    ...convexQuery(
      api.memberships.getAccountHome,
      isAuthenticated ? {} : 'skip',
    ),
    placeholderData: (previousData) => previousData,
    gcTime: ONE_HOUR,
  })

  const { data: prefs } = useQuery({
    ...convexQuery(
      api.userPreferences.getMyPreferences,
      isAuthenticated ? {} : 'skip',
    ),
    gcTime: ONE_HOUR,
  })

  useEffect(() => {
    if (prefs?.homeSectionOrder) {
      setSectionOrder(prefs.homeSectionOrder)
    }
  }, [prefs?.homeSectionOrder])

  const allClasses = accountHome?.classes
  const allSchools = accountHome?.schools
  const children = accountHome?.children

  const matchesClassRole = (classDoc: ClassPublic) =>
    classRoleFilter === 'all' || classDoc.myRole === classRoleFilter

  const matchesSchoolRole = (school: SchoolPublic) =>
    schoolRoleFilter === 'all' || school.myRole === schoolRoleFilter

  const activeClasses =
    allClasses === undefined
      ? undefined
      : allClasses
          .filter((classDoc) => classDoc.archivedTime === undefined)
          .filter(matchesClassRole)
  const archivedClasses =
    allClasses === undefined
      ? undefined
      : allClasses
          .filter((classDoc) => classDoc.archivedTime !== undefined)
          .filter(matchesClassRole)

  const activeSchools =
    allSchools === undefined
      ? undefined
      : allSchools
          .filter((school) => !isSchoolArchived(school))
          .filter(matchesSchoolRole)
  const archivedSchools =
    allSchools === undefined
      ? undefined
      : allSchools
          .filter((school) => isSchoolArchived(school))
          .filter(matchesSchoolRole)

  useEffect(() => {
    return () => {
      if (editFrameRef.current !== null) {
        cancelAnimationFrame(editFrameRef.current)
      }
    }
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sectionOrder.indexOf(active.id as HomeSectionId)
    const newIndex = sectionOrder.indexOf(over.id as HomeSectionId)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(sectionOrder, oldIndex, newIndex)
    setSectionOrder(next)
    void setHomeSectionOrder({ homeSectionOrder: next }).catch(() => {
      // Revert on failure via prefs query refetch.
    })
  }

  const closeClassForm = () => {
    if (editFrameRef.current !== null) {
      cancelAnimationFrame(editFrameRef.current)
      editFrameRef.current = null
    }
    setClassFormOpen(false)
    setClassFormMode('create')
    setEditingClass(null)
  }

  const closeSchoolForm = () => {
    setSchoolFormOpen(false)
    setSchoolFormMode('create')
    setEditingSchool(null)
  }

  const classesSection = (
    <div>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={classRoleFilter}
            onValueChange={(value) => {
              if (isClassRoleFilter(value)) setClassRoleFilter(value)
            }}
          >
            <SelectTrigger
              size="sm"
              aria-label={t('filterByRole')}
              className="min-w-36 rounded-lg"
            >
              <SelectValue placeholder={t('filterByRole')} />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectItem value="all">{t('filterRoleAll')}</SelectItem>
              {CLASS_ROLE_FILTER_OPTIONS.map((role) => (
                <SelectItem key={role} value={role}>
                  {translateClassRole(tClasses, role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SortViewControls
            sort={classSort}
            setSort={setClassSort}
            view={classView}
            setView={setClassView}
            sortAriaLabel={t('sortClasses')}
            viewAriaLabel={t('title')}
          />
          <ClassFormCredenza
            open={classFormOpen}
            onOpenChange={(open) => {
              if (open) setClassFormOpen(true)
              else closeClassForm()
            }}
            mode={classFormMode}
            classDoc={editingClass}
            showTrigger
          />
        </div>
      </div>

      <ClassList
        classes={activeClasses}
        view={classView}
        sort={classSort}
        roleFiltered={classRoleFilter !== 'all'}
        onCreateClick={() => {
          if (editFrameRef.current !== null) {
            cancelAnimationFrame(editFrameRef.current)
            editFrameRef.current = null
          }
          setEditingClass(null)
          setClassFormMode('create')
          setClassFormOpen(true)
        }}
        onEdit={(classDoc) => {
          if (editFrameRef.current !== null) {
            cancelAnimationFrame(editFrameRef.current)
          }
          setClassFormMode('edit')
          setClassFormOpen(true)
          editFrameRef.current = requestAnimationFrame(() => {
            editFrameRef.current = null
            setEditingClass(classDoc)
          })
        }}
      />

      <LinkedStudentsSection linkedChildren={children} />

      <div className="mt-12">
        <h3 className="mb-4 text-xl font-semibold tracking-tight">
          {t('archived')}
        </h3>
        <ClassList
          classes={archivedClasses}
          view={classView}
          sort={classSort}
          archivedOnly
          roleFiltered={classRoleFilter !== 'all'}
        />
      </div>
    </div>
  )

  const schoolsSection = (
    <div>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-3xl font-bold tracking-tight">
          {t('schoolsTitle')}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={schoolRoleFilter}
            onValueChange={(value) => {
              if (isSchoolRoleFilter(value)) setSchoolRoleFilter(value)
            }}
          >
            <SelectTrigger
              size="sm"
              aria-label={tSchools('filterByRole')}
              className="min-w-36 rounded-lg"
            >
              <SelectValue placeholder={tSchools('filterByRole')} />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectItem value="all">{tSchools('filterRoleAll')}</SelectItem>
              {SCHOOL_ORG_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {tSchools(
                    role === 'owner'
                      ? 'roleOwner'
                      : role === 'admin'
                        ? 'roleAdmin'
                        : role === 'principal'
                          ? 'rolePrincipal'
                          : role === 'vicePrincipal'
                            ? 'roleVicePrincipal'
                            : role === 'assistantVicePrincipal'
                              ? 'roleAssistantVicePrincipal'
                              : role === 'teacher'
                                ? 'roleTeacher'
                                : 'roleMember',
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SortViewControls
            sort={schoolSort}
            setSort={setSchoolSort}
            view={schoolView}
            setView={setSchoolView}
            sortAriaLabel={tSchools('sortSchools')}
            viewAriaLabel={t('schoolsTitle')}
          />
          <SchoolFormCredenza
            open={schoolFormOpen}
            onOpenChange={(open) => {
              if (open) setSchoolFormOpen(true)
              else closeSchoolForm()
            }}
            mode={schoolFormMode}
            school={editingSchool}
            showTrigger
          />
        </div>
      </div>

      <SchoolList
        schools={activeSchools}
        view={schoolView}
        sort={schoolSort}
        roleFiltered={schoolRoleFilter !== 'all'}
        onCreateClick={() => {
          setEditingSchool(null)
          setSchoolFormMode('create')
          setSchoolFormOpen(true)
        }}
        onEdit={(school) => {
          setSchoolFormMode('edit')
          setEditingSchool(school)
          setSchoolFormOpen(true)
        }}
      />

      <div className="mt-12">
        <h3 className="mb-4 text-xl font-semibold tracking-tight">
          {tSchools('archived')}
        </h3>
        <SchoolList
          schools={archivedSchools}
          view={schoolView}
          sort={schoolSort}
          archivedOnly
          roleFiltered={schoolRoleFilter !== 'all'}
        />
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:p-8">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={sectionOrder}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-16">
            {sectionOrder.map((id) => (
              <SortableHomeSection key={id} id={id}>
                {id === 'classes' ? classesSection : schoolsSection}
              </SortableHomeSection>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
