import { Link, useRouterState } from '@tanstack/react-router'
import { LayoutGrid, Link2, Settings, Star, Users, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useClassLayout } from '#/components/classes/ClassLayoutContext'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

type NavItem = {
  titleKey:
    | 'navPoints'
    | 'navMembers'
    | 'navStudents'
    | 'navGroups'
    | 'navInvite'
    | 'navSettings'
  to:
    | '/c/$classId/points'
    | '/c/$classId/members'
    | '/c/$classId/students'
    | '/c/$classId/groups'
    | '/c/$classId/invite'
    | '/c/$classId/settings'
  icon: typeof Star
  visible: boolean
}

export function ClassNavMain() {
  const { t } = useTranslation('classes')
  const { classId, canManage, canManageMembers } = useClassLayout()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const items: NavItem[] = [
    {
      titleKey: 'navPoints',
      to: '/c/$classId/points',
      icon: Star,
      visible: true,
    },
    {
      titleKey: 'navMembers',
      to: '/c/$classId/members',
      icon: Users,
      visible: canManage,
    },
    {
      titleKey: 'navStudents',
      to: '/c/$classId/students',
      icon: UsersRound,
      visible: canManageMembers,
    },
    {
      titleKey: 'navGroups',
      to: '/c/$classId/groups',
      icon: LayoutGrid,
      visible: canManageMembers,
    },
    {
      titleKey: 'navInvite',
      to: '/c/$classId/invite',
      icon: Link2,
      visible: canManageMembers,
    },
    {
      titleKey: 'navSettings',
      to: '/c/$classId/settings',
      icon: Settings,
      visible: canManage,
    },
  ]

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t('navClass')}</SidebarGroupLabel>
      <SidebarMenu>
        {items
          .filter((item) => item.visible)
          .map((item) => {
            const href = item.to.replace('$classId', classId)
            const isActive = pathname === href || pathname.startsWith(`${href}/`)
            const Icon = item.icon
            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={t(item.titleKey)}
                >
                  <Link to={item.to} params={{ classId }}>
                    <Icon />
                    <span>{t(item.titleKey)}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
