import i18n from '#/i18n'
import { LANGUAGE_BCP47, coerceAppLanguage } from '#/i18n/locales'

export const CLASS_SORTS = [
  'createdDesc',
  'createdAsc',
  'updatedDesc',
  'updatedAsc',
  'nameAsc',
  'nameDesc',
] as const

export type ClassSort = (typeof CLASS_SORTS)[number]

export type ClassSortField = 'name' | 'created' | 'updated'

export type ClassSortDirection = 'asc' | 'desc'

export const CLASS_SORT_FIELDS = [
  'name',
  'created',
  'updated',
] as const satisfies readonly ClassSortField[]

export const DEFAULT_CLASS_SORT: ClassSort = 'nameAsc'

export function isClassSort(value: string): value is ClassSort {
  return (CLASS_SORTS as readonly string[]).includes(value)
}

export function isClassSortField(value: string): value is ClassSortField {
  return (CLASS_SORT_FIELDS as readonly string[]).includes(value)
}

export function getSortField(sort: ClassSort): ClassSortField {
  if (sort.startsWith('name')) return 'name'
  if (sort.startsWith('updated')) return 'updated'
  return 'created'
}

export function getSortDirection(sort: ClassSort): ClassSortDirection {
  return sort.endsWith('Asc') ? 'asc' : 'desc'
}

export function makeClassSort(
  field: ClassSortField,
  direction: ClassSortDirection,
): ClassSort {
  const suffix = direction === 'asc' ? 'Asc' : 'Desc'
  return `${field}${suffix}`
}

/** Defaults: name → A–Z; created/updated → newest first. */
export function selectClassSortField(
  current: ClassSort,
  field: ClassSortField,
): ClassSort {
  if (getSortField(current) === field) return current

  if (field === 'name') return 'nameAsc'
  if (field === 'created') return 'createdDesc'
  return 'updatedDesc'
}

export function toggleClassSort(sort: ClassSort): ClassSort {
  const nextDirection: ClassSortDirection =
    getSortDirection(sort) === 'asc' ? 'desc' : 'asc'
  return makeClassSort(getSortField(sort), nextDirection)
}

type SortableClass = {
  _id: string
  _creationTime: number
  name: string
  updatedTime?: number
}

function activeBcp47(): string {
  return LANGUAGE_BCP47[coerceAppLanguage(i18n.language)]
}

function compareNames(left: string, right: string): number {
  return left.localeCompare(right, activeBcp47(), { sensitivity: 'base' })
}

export function compareClasses(
  left: SortableClass,
  right: SortableClass,
  sort: ClassSort,
): number {
  let comparison: number

  switch (sort) {
    case 'createdAsc':
      comparison = left._creationTime - right._creationTime
      break
    case 'createdDesc':
      comparison = right._creationTime - left._creationTime
      break
    case 'updatedAsc':
      comparison =
        (left.updatedTime ?? left._creationTime) -
        (right.updatedTime ?? right._creationTime)
      break
    case 'updatedDesc':
      comparison =
        (right.updatedTime ?? right._creationTime) -
        (left.updatedTime ?? left._creationTime)
      break
    case 'nameAsc':
      comparison = compareNames(left.name, right.name)
      break
    case 'nameDesc':
      comparison = compareNames(right.name, left.name)
      break
  }

  if (comparison !== 0) return comparison

  const creationComparison = right._creationTime - left._creationTime
  if (creationComparison !== 0) return creationComparison

  return String(left._id).localeCompare(String(right._id), activeBcp47())
}

export function sortClasses<T extends SortableClass>(
  classes: readonly T[],
  sort: ClassSort,
): T[] {
  return [...classes].sort((left, right) => compareClasses(left, right, sort))
}
