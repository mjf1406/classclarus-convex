import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useConvexAuth } from '@convex-dev/auth/react'
import { ArrowDown, ArrowUp, LayoutGrid, List } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import i18n from '#/i18n'
import { ClassList } from '#/components/classes/ClassList'
import type { ClassListView } from '#/components/classes/ClassList'
import { ClassFormCredenza } from '#/components/classes/ClassFormCredenza'
import { LinkedStudentsSection } from '#/components/classes/LinkedStudentsSection'
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

type RoleFilter = 'all' | ClassDisplayRole

const ROLE_FILTER_OPTIONS = [
  'creator',
  'classTeacher',
  'assistantTeacher',
  'student',
  'guardian',
] as const satisfies readonly ClassDisplayRole[]

function isRoleFilter(value: string): value is RoleFilter {
  return (
    value === 'all' ||
    (ROLE_FILTER_OPTIONS as readonly string[]).includes(value)
  )
}

function Home() {
  const { t } = useTranslation('home')
  const { t: tClasses } = useTranslation('classes')
  const { isAuthenticated } = useConvexAuth()

  const sortFieldLabels: Record<ClassSortField, string> = {
    name: t('sortByName'),
    created: t('sortByCreated'),
    updated: t('sortByUpdated'),
  }
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [editingClass, setEditingClass] = useState<ClassPublic | null>(null)
  const [view, setView] = useState<ClassListView>('grid')
  const [sort, setSort] = useState<ClassSort>(DEFAULT_CLASS_SORT)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const editFrameRef = useRef<number | null>(null)

  const { data: accountHome } = useQuery({
    ...convexQuery(
      api.memberships.getAccountHome,
      isAuthenticated ? {} : 'skip',
    ),
    placeholderData: (previousData) => previousData,
    gcTime: ONE_HOUR,
  })

  const allClasses = accountHome?.classes
  const children = accountHome?.children
  const roleFiltered = roleFilter !== 'all'

  const matchesRole = (classDoc: ClassPublic) =>
    roleFilter === 'all' || classDoc.myRole === roleFilter

  const activeClasses =
    allClasses === undefined
      ? undefined
      : allClasses
          .filter((classDoc) => classDoc.archivedTime === undefined)
          .filter(matchesRole)
  const archivedClasses =
    allClasses === undefined
      ? undefined
      : allClasses
          .filter((classDoc) => classDoc.archivedTime !== undefined)
          .filter(matchesRole)

  const activeSortField = getSortField(sort)
  const activeSortDirection = getSortDirection(sort)
  const SortDirectionIcon = activeSortDirection === 'asc' ? ArrowUp : ArrowDown

  useEffect(() => {
    return () => {
      if (editFrameRef.current !== null) {
        cancelAnimationFrame(editFrameRef.current)
      }
    }
  }, [])

  const closeForm = () => {
    if (editFrameRef.current !== null) {
      cancelAnimationFrame(editFrameRef.current)
      editFrameRef.current = null
    }
    setFormOpen(false)
    setFormMode('create')
    setEditingClass(null)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-4xl font-bold tracking-tight">{t('title')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={roleFilter}
            onValueChange={(value) => {
              if (isRoleFilter(value)) {
                setRoleFilter(value)
              }
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
              {ROLE_FILTER_OPTIONS.map((role) => (
                <SelectItem key={role} value={role}>
                  {translateClassRole(tClasses, role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            aria-label={t('sortClasses')}
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
                  {isActive ? (
                    <SortDirectionIcon data-icon="inline-end" />
                  ) : null}
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
            aria-label={t('title')}
          >
            <ToggleGroupItem value="grid" aria-label={t('viewGrid')}>
              <LayoutGrid />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label={t('viewList')}>
              <List />
            </ToggleGroupItem>
          </ToggleGroup>
          <ClassFormCredenza
            open={formOpen}
            onOpenChange={(open) => {
              if (open) {
                setFormOpen(true)
              } else {
                closeForm()
              }
            }}
            mode={formMode}
            classDoc={editingClass}
            showTrigger
          />
        </div>
      </div>

      <ClassList
        classes={activeClasses}
        view={view}
        sort={sort}
        roleFiltered={roleFiltered}
        onCreateClick={() => {
          if (editFrameRef.current !== null) {
            cancelAnimationFrame(editFrameRef.current)
            editFrameRef.current = null
          }
          setEditingClass(null)
          setFormMode('create')
          setFormOpen(true)
        }}
        onEdit={(classDoc) => {
          if (editFrameRef.current !== null) {
            cancelAnimationFrame(editFrameRef.current)
          }
          setFormMode('edit')
          setFormOpen(true)
          // Bind class data after open has a chance to paint.
          editFrameRef.current = requestAnimationFrame(() => {
            editFrameRef.current = null
            setEditingClass(classDoc)
          })
        }}
      />

      <LinkedStudentsSection children={children} />

      <section className="mt-12">
        <h2 className="mb-4 text-xl font-semibold tracking-tight">
          {t('archived')}
        </h2>
        <ClassList
          classes={archivedClasses}
          view={view}
          sort={sort}
          archivedOnly
          roleFiltered={roleFiltered}
        />
      </section>
    </div>
  )
}
