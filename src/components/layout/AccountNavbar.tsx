import { Link } from '@tanstack/react-router'
import { LogIn } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { UserMenu } from '#/components/auth/UserMenu'
import { Logo } from '#/components/brand/logo'
import { ModeToggle } from '#/components/theme/mode-toggle'
import { LanguageToggle } from '#/i18n/LanguageToggle'
import { Button } from '@/components/ui/button'

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
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/join" aria-label={t('joinClass')}>
              <LogIn data-icon="inline-start" />
              <span className="hidden sm:inline">{t('joinClass')}</span>
            </Link>
          </Button>
          <UserMenu />
          <LanguageToggle />
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
