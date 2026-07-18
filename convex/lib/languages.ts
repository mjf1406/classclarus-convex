import { v } from 'convex/values'

/** App locale IDs (not always BCP-47). */
export const APP_LANGUAGES = [
  'en',
  'ja',
  'ko',
  'zhs',
  'zht',
  'es',
  'fr',
  'it',
  'de',
  'pt',
  'ru',
  'uk',
] as const

export type AppLanguage = (typeof APP_LANGUAGES)[number]

export const DEFAULT_APP_LANGUAGE: AppLanguage = 'en'

export const languageValidator = v.union(
  v.literal('en'),
  v.literal('ja'),
  v.literal('ko'),
  v.literal('zhs'),
  v.literal('zht'),
  v.literal('es'),
  v.literal('fr'),
  v.literal('it'),
  v.literal('de'),
  v.literal('pt'),
  v.literal('ru'),
  v.literal('uk'),
)

/** Class language: concrete locale, or follow each user's personal language. */
export const CLASS_LANGUAGE_USER = 'user' as const

export type ClassLanguage = AppLanguage | typeof CLASS_LANGUAGE_USER

export const DEFAULT_CLASS_LANGUAGE: ClassLanguage = CLASS_LANGUAGE_USER

export const classLanguageValidator = v.union(
  v.literal(CLASS_LANGUAGE_USER),
  languageValidator,
)

export function isAppLanguage(value: string): value is AppLanguage {
  return (APP_LANGUAGES as readonly string[]).includes(value)
}

export function isClassLanguage(value: string): value is ClassLanguage {
  return value === CLASS_LANGUAGE_USER || isAppLanguage(value)
}

export function coerceAppLanguage(
  value: string | undefined | null,
): AppLanguage {
  if (value && isAppLanguage(value)) return value
  return DEFAULT_APP_LANGUAGE
}

/** Missing/legacy unset → use user's language. */
export function coerceClassLanguage(
  value: string | undefined | null,
): ClassLanguage {
  if (value && isClassLanguage(value)) return value
  return DEFAULT_CLASS_LANGUAGE
}
