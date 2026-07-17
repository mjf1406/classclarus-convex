import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import {
  APP_LANGUAGES,
  DEFAULT_APP_LANGUAGE,
  LANGUAGE_BCP47,
  getInitialPersonalLanguage,
} from './locales'
import de from './resources/de'
import en from './resources/en'
import es from './resources/es'
import fr from './resources/fr'
import it from './resources/it'
import ja from './resources/ja'
import ko from './resources/ko'
import pt from './resources/pt'
import ru from './resources/ru'
import uk from './resources/uk'
import zhs from './resources/zhs'
import zht from './resources/zht'

const catalogs = {
  en,
  ja,
  ko,
  zhs,
  zht,
  es,
  fr,
  it,
  de,
  pt,
  ru,
  uk,
} as const

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

const initialLanguage = getInitialPersonalLanguage()
if (typeof document !== 'undefined') {
  document.documentElement.lang = LANGUAGE_BCP47[initialLanguage]
}

function toResources() {
  const resources: Record<
    string,
    Record<(typeof i18nNamespaces)[number], Record<string, string>>
  > = {}
  for (const lng of APP_LANGUAGES) {
    const catalog = catalogs[lng]
    resources[lng] = {
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
  return resources
}

void i18n.use(initReactI18next).init({
  resources: toResources(),
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
