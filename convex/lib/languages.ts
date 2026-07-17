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

export function isAppLanguage(value: string): value is AppLanguage {
  return (APP_LANGUAGES as readonly string[]).includes(value)
}

export function coerceAppLanguage(
  value: string | undefined | null,
): AppLanguage {
  if (value && isAppLanguage(value)) return value
  return DEFAULT_APP_LANGUAGE
}
