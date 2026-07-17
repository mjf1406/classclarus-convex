import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, LayoutGrid, List } from 'lucide-react'

import { ClassList } from '#/components/classes/ClassList'
import type { ClassListView } from '#/components/classes/ClassList'
import { ClassFormCredenza } from '#/components/classes/ClassFormCredenza'
import {
  DEFAULT_CLASS_SORT,
  getSortDirection,
  getSortField,
  isClassSortField,
  selectClassSortField,
  toggleClassSort,
} from '#/lib/classSort'
import type { ClassSort, ClassSortField } from '#/lib/classSort'
import type { ClassPublic } from '#/lib/classes'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export const Route = createFileRoute('/_account/')({
  component: Home,
  head: () => ({
    meta: [
      {
        name: 'ClassClarus',
        content: 'Manage your classes for the ClassClarus webapp',
      },
      {
        title: 'My Classes | ClassClarus',
      },
    ],
  }),
})

type FormMode = 'create' | 'edit'

const SORT_FIELD_LABELS: Record<ClassSortField, string> = {
  name: 'Name',
  created: 'Created',
  updated: 'Updated',
}

function Home() {
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [editingClass, setEditingClass] = useState<ClassPublic | null>(null)
  const [view, setView] = useState<ClassListView>('grid')
  const [sort, setSort] = useState<ClassSort>(DEFAULT_CLASS_SORT)
  const editFrameRef = useRef<number | null>(null)

  const activeSortField = getSortField(sort)
  const activeSortDirection = getSortDirection(sort)
  const SortDirectionIcon =
    activeSortDirection === 'asc' ? ArrowUp : ArrowDown

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
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-4xl font-bold tracking-tight">My Classes</h1>
        <div className="flex flex-wrap items-center gap-2">
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
            aria-label="Sort classes"
          >
            {(['name', 'created', 'updated'] as const).map((field) => {
              const isActive = field === activeSortField
              return (
                <ToggleGroupItem
                  key={field}
                  value={field}
                  aria-label={
                    isActive
                      ? `Sort by ${SORT_FIELD_LABELS[field]}, ${
                          activeSortDirection === 'asc'
                            ? 'ascending'
                            : 'descending'
                        }. Click to reverse.`
                      : `Sort by ${SORT_FIELD_LABELS[field]}`
                  }
                >
                  {SORT_FIELD_LABELS[field]}
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
            aria-label="Class list layout"
          >
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <LayoutGrid />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view">
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
        view={view}
        sort={sort}
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

      <section className="mt-12">
        <h2 className="mb-4 text-xl font-semibold tracking-tight">Archived</h2>
        <ClassList view={view} sort={sort} archivedOnly />
      </section>
    </div>
  )
}
