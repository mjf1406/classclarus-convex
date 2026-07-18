import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react'
import { useTranslation } from 'react-i18next'
import { ONE_HOUR } from '#/lib/queryCache'
import { Button } from '../ui/button'
import { api } from '../../../convex/_generated/api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { SignOutButton } from './SignOut'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
type CurrentUser = {
  name?: string
  email?: string
  image?: string
}

function getInitials(user: CurrentUser) {
  if (user.name && user.name.trim()) {
    const parts = user.name.trim().split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
    }
    return user.name.trim().slice(0, 2).toUpperCase()
  }
  const local = user.email?.split('@')[0] ?? user.email
  const localStr = local ?? ''
  const parts = localStr.split(/[._-]/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase()
  }
  return local ?? ''
}

function getDisplayName(user: CurrentUser) {
  if (user.name && user.name.trim()) {
    return user.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ')
  }
  const local = user.email?.split('@')[0] ?? user.email
  const localStr = local ?? ''
  return localStr
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function UserMenu() {
  const { t } = useTranslation('common')
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { data: user } = useQuery({
    ...convexQuery(api.users.current, isAuthenticated ? {} : 'skip'),
    gcTime: ONE_HOUR,
  })
  const { signOut } = useAuthActions()

  if (isLoading || (isAuthenticated && user === undefined)) {
    return (
      <Avatar>
        <AvatarFallback>...</AvatarFallback>
      </Avatar>
    )
  }

  if (!user?.email) {
    return (
      <Button variant="ghost" size="sm" asChild>
        <Link to="/login">{t('signIn')}</Link>
      </Button>
    )
  }

  const email = user.email
  const initials = getInitials(user)
  const displayName = getDisplayName(user)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={t('openUserMenu')}
        >
          <Avatar>
            {user.image ? (
              <AvatarImage src={user.image} alt={displayName} />
            ) : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <div className="flex items-center gap-3 p-3">
          <Avatar>
            {user.image ? (
              <AvatarImage src={user.image} alt={displayName} />
            ) : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-none">
              {displayName}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {email}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer"
          onClick={() => void signOut()}
        >
          <SignOutButton className="w-full" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
