import { Link } from '@tanstack/react-router'
import { Button } from '../ui/button'
import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react'
import { useQuery } from 'convex/react'
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

function getInitials(email: string) {
  const local = email.split('@')[0] ?? email
  const parts = local.split(/[._-]/).filter(Boolean)
  if (parts.length >= 2) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  }
  return local.slice(0, 2).toUpperCase()
}

function getDisplayName(email: string) {
  const local = email.split('@')[0] ?? email
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function UserMenu() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const user = useQuery(api.users.current, isAuthenticated ? {} : 'skip')
  const { signOut } = useAuthActions()

  if (isLoading || (isAuthenticated && user === undefined)) {
    return (
      <Avatar size="sm">
        <AvatarFallback>...</AvatarFallback>
      </Avatar>
    )
  }

  if (!user?.email) {
    return (
      <Button variant="ghost" size="sm" asChild>
        <Link to="/login">Sign in</Link>
      </Button>
    )
  }

  const email = user.email
  const initials = getInitials(email)
  const displayName = user.name ?? getDisplayName(email)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Open user menu"
        >
          <Avatar size="sm">
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
