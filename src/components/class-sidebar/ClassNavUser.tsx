import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react'
import {
  ChevronsUpDown,
  CreditCard,
  LogIn,
  LogOut,
  Settings,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ONE_HOUR } from '#/lib/queryCache'
import { getDisplayName, getInitials } from '#/lib/userDisplay'
import { api } from '../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

type ClassNavUserProps = {
  variant?: 'sidebar' | 'avatar'
}

function useAccountMenuState() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { data: user } = useQuery({
    ...convexQuery(api.users.current, isAuthenticated ? {} : 'skip'),
    gcTime: ONE_HOUR,
  })
  const { signOut } = useAuthActions()

  return {
    isLoading,
    isAuthenticated,
    user,
    signOut,
  }
}

function AccountMenuItems({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useTranslation('common')

  return (
    <>
      <DropdownMenuItem asChild>
        <Link to="/join">
          <LogIn />
          {t('joinClass')}
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link to="/settings">
          <Settings />
          {t('settings')}
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link to="/account">
          <CreditCard />
          {t('account')}
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={() => {
          onSignOut()
        }}
      >
        <LogOut />
        {t('signOut')}
      </DropdownMenuItem>
    </>
  )
}

function ClassNavUserAvatar() {
  const { t } = useTranslation('common')
  const { isLoading, isAuthenticated, user, signOut } = useAccountMenuState()

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

  const displayName = getDisplayName(user)
  const initials = getInitials(user)

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
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <AccountMenuItems
          onSignOut={() => {
            void signOut()
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ClassNavUserSidebar() {
  const { t } = useTranslation('common')
  const { isMobile } = useSidebar()
  const { isLoading, isAuthenticated, user, signOut } = useAccountMenuState()

  if (isLoading || (isAuthenticated && user === undefined)) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className="rounded-lg">…</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{t('loading')}</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!user?.email) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" asChild>
            <Link to="/login">{t('signIn')}</Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const displayName = getDisplayName(user)
  const initials = getInitials(user)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                {user.image ? (
                  <AvatarImage src={user.image} alt={displayName} />
                ) : null}
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <AccountMenuItems
              onSignOut={() => {
                void signOut()
              }}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function ClassNavUser({ variant = 'sidebar' }: ClassNavUserProps) {
  if (variant === 'avatar') {
    return <ClassNavUserAvatar />
  }
  return <ClassNavUserSidebar />
}
