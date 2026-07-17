import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { RocketIcon } from 'lucide-react'

import { PulsatingButton } from '@/components/ui/pulsating-button'
import { SparklesText } from '@/components/ui/sparkles-text'

const UPDATE_TOAST_ID = 'pwa-update'

export function PwaUpdatePrompt() {
  const { t } = useTranslation('pwa')
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl) {
      if (import.meta.env.DEV) {
        console.info('[pwa] service worker registered:', swUrl)
      }
    },
    onRegisterError(error) {
      console.error('[pwa] service worker registration error:', error)
    },
  })

  const shownRef = useRef(false)

  useEffect(() => {
    if (!needRefresh || shownRef.current) return
    shownRef.current = true

    toast.custom(
      () => (
        <div className="mt-[max(0.5rem,env(safe-area-inset-top))] flex w-[92vw] max-w-md flex-col items-center gap-5 rounded-2xl border border-blue-300 bg-blue-50 p-7 text-center shadow-2xl dark:border-blue-600 dark:bg-blue-950">
          <div className="flex size-16 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-300">
            <RocketIcon className="size-9" />
          </div>

          <SparklesText
            className="text-2xl leading-tight sm:text-3xl"
            colors={{ first: '#3b82f6', second: '#f43f7f' }}
            sparklesCount={12}
          >
            {t('updateTitle')}
          </SparklesText>

          <p className="text-base text-blue-900/80 dark:text-blue-100/80">
            {t('updateBody')}
          </p>

          <PulsatingButton
            type="button"
            duration="1.2s"
            distance="12px"
            onClick={() => {
              void updateServiceWorker(true)
            }}
            className="w-full bg-blue-600 px-8 py-5 text-lg font-semibold text-white hover:bg-blue-700"
          >
            {t('refreshNow')}
          </PulsatingButton>
        </div>
      ),
      {
        id: UPDATE_TOAST_ID,
        duration: Infinity,
        position: 'top-center',
        dismissible: false,
      },
    )
  }, [needRefresh, updateServiceWorker, t])

  return null
}
