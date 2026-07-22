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

export const PERSONAL_LANGUAGE_STORAGE_KEY = 'classclarus-language'

/** Native / English labels for the language picker. */
export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  zhs: '简体中文',
  zht: '繁體中文',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  de: 'Deutsch',
  pt: 'Português',
  ru: 'Русский',
  uk: 'Українська',
}

/** BCP-47 tags for `html[lang]` and Intl. */
export const LANGUAGE_BCP47: Record<AppLanguage, string> = {
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

/** Class language: concrete locale, or follow each user's personal language. */
export const CLASS_LANGUAGE_USER = 'user' as const

export type ClassLanguage = AppLanguage | typeof CLASS_LANGUAGE_USER

export const DEFAULT_CLASS_LANGUAGE: ClassLanguage = CLASS_LANGUAGE_USER

export function isAppLanguage(value: string): value is AppLanguage {
  return (APP_LANGUAGES as ReadonlyArray<string>).includes(value)
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

/**
 * Map browser / BCP-47 tags to app locale IDs.
 * Order matters: more specific prefixes first where needed.
 */
export function mapBrowserLanguageToApp(tag: string): AppLanguage {
  const normalized = tag.trim().toLowerCase().replace(/_/g, '-')
  if (!normalized) return DEFAULT_APP_LANGUAGE

  if (normalized === 'zh-hans' || normalized.startsWith('zh-hans-'))
    return 'zhs'
  if (normalized === 'zh-hant' || normalized.startsWith('zh-hant-'))
    return 'zht'
  if (
    normalized === 'zh-cn' ||
    normalized === 'zh-sg' ||
    normalized.startsWith('zh-cn-') ||
    normalized.startsWith('zh-sg-')
  ) {
    return 'zhs'
  }
  if (
    normalized === 'zh-tw' ||
    normalized === 'zh-hk' ||
    normalized === 'zh-mo' ||
    normalized.startsWith('zh-tw-') ||
    normalized.startsWith('zh-hk-') ||
    normalized.startsWith('zh-mo-')
  ) {
    return 'zht'
  }
  if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zhs'

  const primary = normalized.split('-')[0] ?? normalized
  if (isAppLanguage(primary)) return primary
  if (primary === 'zh') return 'zhs'

  return DEFAULT_APP_LANGUAGE
}

export function detectBrowserAppLanguage(): AppLanguage {
  if (typeof navigator === 'undefined') return DEFAULT_APP_LANGUAGE
  const candidates = [...navigator.languages, navigator.language].filter(
    Boolean,
  )
  for (const tag of candidates) {
    const mapped = mapBrowserLanguageToApp(tag)
    if (mapped !== DEFAULT_APP_LANGUAGE || tag.toLowerCase().startsWith('en')) {
      return mapped
    }
  }
  const first = candidates[0]
  return first ? mapBrowserLanguageToApp(first) : DEFAULT_APP_LANGUAGE
}

export function readStoredPersonalLanguage(): AppLanguage | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(PERSONAL_LANGUAGE_STORAGE_KEY)
    return stored && isAppLanguage(stored) ? stored : null
  } catch {
    return null
  }
}

export function writeStoredPersonalLanguage(language: AppLanguage): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PERSONAL_LANGUAGE_STORAGE_KEY, language)
  } catch (error) {
    console.warn('[i18n] failed to persist language preference', error)
  }
}

/**
 * Resolve personal language: stored preference wins, otherwise detect from
 * navigator and persist so the key always exists after first app load.
 */
export function getInitialPersonalLanguage(): AppLanguage {
  const stored = readStoredPersonalLanguage()
  if (stored) return stored

  const detected = detectBrowserAppLanguage()
  writeStoredPersonalLanguage(detected)
  return detected
}

/** Ensure the storage key exists (safe to call on every mount). */
export function ensurePersonalLanguagePersisted(
  language: AppLanguage = getInitialPersonalLanguage(),
): AppLanguage {
  if (!readStoredPersonalLanguage()) {
    writeStoredPersonalLanguage(language)
  }
  return language
}
