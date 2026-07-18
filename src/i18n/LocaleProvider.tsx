import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { useConvexAuth } from '@convex-dev/auth/react'
import { useMutation, useQuery } from 'convex/react'
import { I18nextProvider } from 'react-i18next'

import { api } from '../../convex/_generated/api'
import i18n, { ensureLanguageLoaded } from './index'
import {
  LANGUAGE_BCP47,
  coerceAppLanguage,
  ensurePersonalLanguagePersisted,
  getInitialPersonalLanguage,
  writeStoredPersonalLanguage,
} from './locales'
import type { AppLanguage } from './locales'
import { useActiveLocale } from './useActiveLocale'

type PersonalLocaleContextValue = {
  personalLanguage: AppLanguage
  setPersonalLanguage: (language: AppLanguage) => void
  canChooseLanguage: boolean
}

const PersonalLocaleContext = createContext<
  PersonalLocaleContextValue | undefined
>(undefined)

function applyDocumentLang(language: AppLanguage) {
  document.documentElement.lang = LANGUAGE_BCP47[language]
}

function PersonalLocaleInner({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth()
  const currentUser = useQuery(
    api.users.current,
    isAuthenticated ? {} : 'skip',
  )
  const prefs = useQuery(
    api.userPreferences.getMyPreferences,
    isAuthenticated && currentUser ? {} : 'skip',
  )
  const setMyLanguage = useMutation(api.userPreferences.setMyLanguage)

  const [personalLanguage, setPersonalLanguageState] = useState<AppLanguage>(
    () => getInitialPersonalLanguage(),
  )

  // Persist on mount even if module-init write was skipped (HMR / late storage).
  useLayoutEffect(() => {
    ensurePersonalLanguagePersisted(personalLanguage)
    applyDocumentLang(personalLanguage)
  }, [personalLanguage])

  // Hydrate from Convex when available (server wins over local guess).
  useLayoutEffect(() => {
    if (prefs === undefined || prefs === null) return
    const fromServer = coerceAppLanguage(prefs.language)
    setPersonalLanguageState(fromServer)
    writeStoredPersonalLanguage(fromServer)
  }, [prefs])

  const setPersonalLanguage = useCallback(
    (language: AppLanguage) => {
      setPersonalLanguageState(language)
      writeStoredPersonalLanguage(language)
      if (isAuthenticated) {
        void setMyLanguage({ language }).catch((error: unknown) => {
          console.error('Failed to save language preference', error)
        })
      }
    },
    [isAuthenticated, setMyLanguage],
  )

  const { activeLanguage, canChooseLanguage } =
    useActiveLocale(personalLanguage)

  useLayoutEffect(() => {
    let cancelled = false
    void (async () => {
      await ensureLanguageLoaded(activeLanguage)
      if (cancelled) return
      if (i18n.language !== activeLanguage) {
        await i18n.changeLanguage(activeLanguage)
      }
      applyDocumentLang(activeLanguage)
    })()
    return () => {
      cancelled = true
    }
  }, [activeLanguage])

  const value = useMemo(
    () => ({
      personalLanguage,
      setPersonalLanguage,
      canChooseLanguage,
    }),
    [personalLanguage, setPersonalLanguage, canChooseLanguage],
  )

  return (
    <PersonalLocaleContext.Provider value={value}>
      {children}
    </PersonalLocaleContext.Provider>
  )
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <PersonalLocaleInner>{children}</PersonalLocaleInner>
    </I18nextProvider>
  )
}

export function usePersonalLocale() {
  const context = useContext(PersonalLocaleContext)
  if (context === undefined) {
    throw new Error('usePersonalLocale must be used within a LocaleProvider')
  }
  return context
}
