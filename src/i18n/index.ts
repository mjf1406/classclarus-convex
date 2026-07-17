import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import {
  APP_LANGUAGES,
  DEFAULT_APP_LANGUAGE,
  LANGUAGE_BCP47,
  getInitialPersonalLanguage,
} from './locales'
import type { AppLanguage } from './locales'
import en from './resources/en'

export const i18nNamespaces = [
  'common',
  'auth',
  'pwa',
  'home',
  'join',
  'classes',
  'settings',
  'account',
] as const

type LocaleCatalog = typeof en

const localeLoaders: Record<
  AppLanguage,
  () => Promise<{ default: LocaleCatalog }>
> = {
  en: () => Promise.resolve({ default: en }),
  ja: () => import('./resources/ja'),
  ko: () => import('./resources/ko'),
  zhs: () => import('./resources/zhs'),
  zht: () => import('./resources/zht'),
  es: () => import('./resources/es'),
  fr: () => import('./resources/fr'),
  it: () => import('./resources/it'),
  de: () => import('./resources/de'),
  pt: () => import('./resources/pt'),
  ru: () => import('./resources/ru'),
  uk: () => import('./resources/uk'),
}

const loadedLanguages = new Set<AppLanguage>([DEFAULT_APP_LANGUAGE])

function addCatalog(lng: AppLanguage, catalog: LocaleCatalog) {
  for (const ns of i18nNamespaces) {
    i18n.addResourceBundle(lng, ns, catalog[ns], true, true)
  }
  loadedLanguages.add(lng)
}

function catalogToResources(catalog: LocaleCatalog) {
  return {
    common: catalog.common,
    auth: catalog.auth,
    pwa: catalog.pwa,
    home: catalog.home,
    join: catalog.join,
    classes: catalog.classes,
    settings: catalog.settings,
    account: catalog.account,
  }
}

/** Ensure a locale catalog is registered before calling changeLanguage. */
export async function ensureLanguageLoaded(lng: AppLanguage): Promise<void> {
  if (loadedLanguages.has(lng)) return
  const { default: catalog } = await localeLoaders[lng]()
  addCatalog(lng, catalog)
}

const initialLanguage = getInitialPersonalLanguage()
if (typeof document !== 'undefined') {
  document.documentElement.lang = LANGUAGE_BCP47[initialLanguage]
}

const resources: Record<string, ReturnType<typeof catalogToResources>> = {
  [DEFAULT_APP_LANGUAGE]: catalogToResources(en),
}

if (initialLanguage !== DEFAULT_APP_LANGUAGE) {
  const { default: catalog } = await localeLoaders[initialLanguage]()
  resources[initialLanguage] = catalogToResources(catalog)
  loadedLanguages.add(initialLanguage)
}

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: DEFAULT_APP_LANGUAGE,
  supportedLngs: [...APP_LANGUAGES],
  ns: [...i18nNamespaces],
  defaultNS: 'common',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
})

export default i18n
