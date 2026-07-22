import { DEFAULT_APP_LANGUAGE, coerceAppLanguage } from './languages'
import type { AppLanguage } from './languages'

/** BCP-47 tags for Intl name compares (mirrors src/i18n/locales). */
const LANGUAGE_BCP47: Record<AppLanguage, string> = {
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  zhs: 'zh-Hans',
  zht: 'zh-Hant',
  es: 'es',
  fr: 'fr',
  it: 'it',
  de: 'de',
  pt: 'pt',
  ru: 'ru',
  uk: 'uk',
}

export const CLASS_SORTS = [
  'createdDesc',
  'createdAsc',
  'updatedDesc',
  'updatedAsc',
  'nameAsc',
  'nameDesc',
] as const

export type ClassSort = (typeof CLASS_SORTS)[number]

export const DEFAULT_CLASS_SORT: ClassSort = 'nameAsc'

type SortableClass = {
  _id: string
  _creationTime: number
  name: string
  updatedTime?: number
}

function localeForCompare(language?: string): string {
  return LANGUAGE_BCP47[coerceAppLanguage(language ?? DEFAULT_APP_LANGUAGE)]
}

function compareNames(left: string, right: string, language?: string): number {
  return left.localeCompare(right, localeForCompare(language), {
    sensitivity: 'base',
  })
}

export function compareClasses(
  left: SortableClass,
  right: SortableClass,
  sort: ClassSort,
  language?: string,
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
      comparison = compareNames(left.name, right.name, language)
      break
    case 'nameDesc':
      comparison = compareNames(right.name, left.name, language)
      break
  }

  if (comparison !== 0) return comparison

  const creationComparison = right._creationTime - left._creationTime
  if (creationComparison !== 0) return creationComparison

  return String(left._id).localeCompare(
    String(right._id),
    localeForCompare(language),
  )
}

export function sortClasses<T extends SortableClass>(
  classes: ReadonlyArray<T>,
  sort: ClassSort,
  language?: string,
): Array<T> {
  return [...classes].sort((left, right) =>
    compareClasses(left, right, sort, language),
  )
}
