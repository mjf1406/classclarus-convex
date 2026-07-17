import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useConvexAuth } from '@convex-dev/auth/react'
import { useTranslation } from 'react-i18next'

import i18n from '#/i18n'
import { ONE_HOUR } from '#/lib/queryCache'
import { api } from '../../../convex/_generated/api'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_account/account')({
  component: AccountPage,
  head: () => ({
    meta: [
      {
        name: 'description',
        content: i18n.t('account:docDescription'),
      },
      {
        title: i18n.t('account:docTitle'),
      },
    ],
  }),
})

function AccountPage() {
  const { t } = useTranslation('account')
  const { isAuthenticated } = useConvexAuth()
  const { data: user } = useQuery({
    ...convexQuery(api.users.current, isAuthenticated ? {} : 'skip'),
    gcTime: ONE_HOUR,
  })

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:p-8">
      <h1 className="text-4xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>

      <section className="mt-8 border-t border-border pt-8">
        <h2 className="text-xl font-semibold tracking-tight">
          {t('profileLabel')}
        </h2>
        {user === undefined ? (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-64" />
          </div>
        ) : (
          <div className="mt-3 space-y-1">
            {user?.name ? <p className="text-sm">{user.name}</p> : null}
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        )}
      </section>

      <section className="mt-8 border-t border-border pt-8">
        <h2 className="text-xl font-semibold tracking-tight">
          {t('paymentsTitle')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('paymentsComingSoon')}
        </p>
      </section>
    </main>
  )
}
