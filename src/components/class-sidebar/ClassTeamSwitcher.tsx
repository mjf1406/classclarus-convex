import { Link, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { Check, ChevronsUpDown, GraduationCap } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useClassLayout } from '#/components/classes/ClassLayoutContext'
import { classLabel } from '#/components/classes/classLabel'
import { TEN_MINUTES } from '#/lib/queryCache'
import { sortClasses } from '#/lib/classSort'
import { api } from '../../../convex/_generated/api'
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

type ClassSubpage = 'points' | 'members' | 'students' | 'groups' | 'invite' | 'settings'

function getSubpageFromPath(pathname: string): ClassSubpage {
  if (pathname.endsWith('/members')) return 'members'
  if (pathname.endsWith('/students')) return 'students'
  if (pathname.endsWith('/groups')) return 'groups'
  if (pathname.endsWith('/invite')) return 'invite'
  if (pathname.endsWith('/settings')) return 'settings'
  return 'points'
}

const SUBPAGE_ROUTES = {
  points: '/c/$classId/points',
  members: '/c/$classId/members',
  students: '/c/$classId/students',
  groups: '/c/$classId/groups',
  invite: '/c/$classId/invite',
  settings: '/c/$classId/settings',
} as const

export function ClassTeamSwitcher() {
  const { t, i18n } = useTranslation('classes')
  const { isMobile } = useSidebar()
  const { classId, classDoc } = useClassLayout()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const subpage = getSubpageFromPath(pathname)

  const { data: classes } = useQuery({
    ...convexQuery(api.memberships.listMyClasses, {}),
    gcTime: TEN_MINUTES,
  })

  const activeClasses = (classes ?? []).filter(
    (c) => c.archivedTime === undefined,
  )
  const sortedClasses = sortClasses(activeClasses, 'nameAsc', i18n.language)
  const currentLabel = classLabel(classDoc, t('classFallback'))

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="min-w-0 overflow-hidden data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              tooltip={currentLabel}
            >
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <GraduationCap className="size-4" />
              </div>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium" title={currentLabel}>
                  {currentLabel}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {t('switchClass')}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 shrink-0" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t('switchClass')}
            </DropdownMenuLabel>
            <div className="max-h-48 overflow-x-hidden overflow-y-auto p-1">
              {sortedClasses.map((classItem) => {
                const label = classLabel(classItem, t('classFallback'))
                const isActive = classItem._id === classId
                return (
                  <DropdownMenuItem
                    key={classItem._id}
                    asChild
                    className="min-w-0 p-2"
                  >
                    <Link
                      to={SUBPAGE_ROUTES[subpage]}
                      params={{ classId: classItem._id }}
                      className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"
                    >
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-md border">
                        <GraduationCap className="size-3.5 shrink-0" />
                      </div>
                      <span className="truncate" title={label}>
                        {label}
                      </span>
                      {isActive ? (
                        <Check className="size-4 shrink-0" />
                      ) : (
                        <span className="size-4 shrink-0" aria-hidden />
                      )}
                    </Link>
                  </DropdownMenuItem>
                )
              })}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/">{t('allClasses')}</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
