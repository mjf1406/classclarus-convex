import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { ClassNavUser } from '#/components/class-sidebar/ClassNavUser'
import { Logo } from '#/components/brand/logo'

export function AccountNavbar() {
  const { t } = useTranslation('common')

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-8">
        <Link
          to="/"
          className="flex shrink-0 items-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={t('home')}
        >
          <Logo />
        </Link>
        <ClassNavUser variant="avatar" />
      </div>
    </header>
  )
}
