import { Link } from '@tanstack/react-router'
import { LogIn } from 'lucide-react'

import { UserMenu } from '#/components/auth/UserMenu'
import { Logo } from '#/components/brand/logo'
import { ModeToggle } from '#/components/theme/mode-toggle'
import { Button } from '@/components/ui/button'

export function AccountNavbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-8">
        <Link
          to="/"
          className="flex shrink-0 items-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="ClassClarus home"
        >
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/join" aria-label="Join a class">
              <LogIn data-icon="inline-start" />
              <span className="hidden sm:inline">Join a class</span>
            </Link>
          </Button>
          <UserMenu />
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
