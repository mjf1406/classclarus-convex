import { useEffect, useRef, useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  ChevronRight,
  LayoutGrid,
  Settings,
  Star,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useClassLayout } from '#/components/classes/ClassLayoutContext'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'

type TopNavItem = {
  titleKey: 'navPoints' | 'navGroups' | 'navSettings'
  to: '/c/$classId/points' | '/c/$classId/groups' | '/c/$classId/settings'
  icon: typeof Star
  visible: boolean
}

type MembersSubItem = {
  titleKey:
    | 'navInvite'
    | 'navTeachers'
    | 'navAssistantTeachers'
    | 'navStudents'
    | 'navGuardians'
  to:
    | '/c/$classId/members/invite'
    | '/c/$classId/teachers'
    | '/c/$classId/assistant-teachers'
    | '/c/$classId/students'
    | '/c/$classId/guardians'
}

const MEMBERS_SUB_ITEMS: Array<MembersSubItem> = [
  { titleKey: 'navInvite', to: '/c/$classId/members/invite' },
  { titleKey: 'navTeachers', to: '/c/$classId/teachers' },
  { titleKey: 'navAssistantTeachers', to: '/c/$classId/assistant-teachers' },
  { titleKey: 'navStudents', to: '/c/$classId/students' },
  { titleKey: 'navGuardians', to: '/c/$classId/guardians' },
]

function isMembersPath(pathname: string, classId: string): boolean {
  const membersPrefix = `/c/${classId}/members`
  if (pathname === membersPrefix || pathname.startsWith(`${membersPrefix}/`)) {
    return true
  }
  return MEMBERS_SUB_ITEMS.some((item) => {
    const href = item.to.replace('$classId', classId)
    return pathname === href || pathname.startsWith(`${href}/`)
  })
}

export function ClassNavMain() {
  const { t } = useTranslation('classes')
  const { state, isMobile } = useSidebar()
  const { classId, canManage, canManageMembers } = useClassLayout()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const membersSectionActive = isMembersPath(pathname, classId)
  const [membersOpen, setMembersOpen] = useState(membersSectionActive)
  const [membersMenuOpen, setMembersMenuOpen] = useState(false)
  const membersMenuCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const isCollapsedDesktop = state === 'collapsed' && !isMobile

  useEffect(() => {
    if (membersSectionActive) setMembersOpen(true)
  }, [membersSectionActive])

  useEffect(() => {
    return () => {
      if (membersMenuCloseTimeoutRef.current) {
        clearTimeout(membersMenuCloseTimeoutRef.current)
      }
    }
  }, [])

  const openMembersMenu = () => {
    if (membersMenuCloseTimeoutRef.current) {
      clearTimeout(membersMenuCloseTimeoutRef.current)
      membersMenuCloseTimeoutRef.current = null
    }
    setMembersMenuOpen(true)
  }

  const scheduleCloseMembersMenu = () => {
    if (membersMenuCloseTimeoutRef.current) {
      clearTimeout(membersMenuCloseTimeoutRef.current)
    }
    membersMenuCloseTimeoutRef.current = setTimeout(() => {
      setMembersMenuOpen(false)
      membersMenuCloseTimeoutRef.current = null
    }, 100)
  }

  const items: Array<TopNavItem> = [
    {
      titleKey: 'navPoints',
      to: '/c/$classId/points',
      icon: Star,
      visible: true,
    },
    {
      titleKey: 'navGroups',
      to: '/c/$classId/groups',
      icon: LayoutGrid,
      visible: canManageMembers,
    },
    {
      titleKey: 'navSettings',
      to: '/c/$classId/settings',
      icon: Settings,
      visible: canManage,
    },
  ]

  const renderTopItem = (item: TopNavItem) => {
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
  }

  const renderMembersSubLinks = () =>
    MEMBERS_SUB_ITEMS.map((item) => {
      const href = item.to.replace('$classId', classId)
      const isActive = pathname === href || pathname.startsWith(`${href}/`)
      return (
        <SidebarMenuSubItem key={item.to}>
          <SidebarMenuSubButton asChild isActive={isActive}>
            <Link to={item.to} params={{ classId }}>
              <span>{t(item.titleKey)}</span>
            </Link>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      )
    })

  const renderMembersMenuItems = () =>
    MEMBERS_SUB_ITEMS.map((item) => (
      <DropdownMenuItem key={item.to} asChild>
        <Link to={item.to} params={{ classId }}>
          {t(item.titleKey)}
        </Link>
      </DropdownMenuItem>
    ))

  const pointsItem = items.find((item) => item.titleKey === 'navPoints')
  const trailingItems = items.filter(
    (item) => item.visible && item.titleKey !== 'navPoints',
  )

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t('navClass')}</SidebarGroupLabel>
      <SidebarMenu>
        {pointsItem ? renderTopItem(pointsItem) : null}

        {canManageMembers ? (
          isCollapsedDesktop ? (
            <SidebarMenuItem>
              <DropdownMenu
                open={membersMenuOpen}
                onOpenChange={setMembersMenuOpen}
              >
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    isActive={membersSectionActive}
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    onMouseEnter={openMembersMenu}
                    onMouseLeave={scheduleCloseMembersMenu}
                  >
                    <Users />
                    <span>{t('navMembers')}</span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="right"
                  align="start"
                  sideOffset={4}
                  className="min-w-48 rounded-lg"
                  onMouseEnter={openMembersMenu}
                  onMouseLeave={scheduleCloseMembersMenu}
                >
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {t('navMembers')}
                  </DropdownMenuLabel>
                  {renderMembersMenuItems()}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          ) : (
            <Collapsible
              open={membersOpen}
              onOpenChange={setMembersOpen}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={t('navMembers')}
                    isActive={membersSectionActive}
                  >
                    <Users />
                    <span>{t('navMembers')}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>{renderMembersSubLinks()}</SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )
        ) : null}

        {trailingItems.map(renderTopItem)}
      </SidebarMenu>
    </SidebarGroup>
  )
}
