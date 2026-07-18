import { useEffect, useRef, useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  ChevronRight,
  LayoutGrid,
  Link2,
  School,
  Settings,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useSchoolLayout } from '#/components/schools/SchoolLayoutContext'
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
  titleKey: 'navClasses' | 'navTeams' | 'navInvite' | 'navSettings'
  to:
    | '/s/$schoolId/classes'
    | '/s/$schoolId/teams'
    | '/s/$schoolId/invite'
    | '/s/$schoolId/settings'
  icon: typeof LayoutGrid
  visible: boolean
}

type MembersSubItem = {
  titleKey: 'navPrincipals' | 'navTeachers' | 'navAdmins'
  to:
    | '/s/$schoolId/principals'
    | '/s/$schoolId/teachers'
    | '/s/$schoolId/admins'
}

const MEMBERS_SUB_ITEMS: Array<MembersSubItem> = [
  { titleKey: 'navPrincipals', to: '/s/$schoolId/principals' },
  { titleKey: 'navTeachers', to: '/s/$schoolId/teachers' },
  { titleKey: 'navAdmins', to: '/s/$schoolId/admins' },
]

function isMembersPath(pathname: string, schoolId: string): boolean {
  return MEMBERS_SUB_ITEMS.some((item) => {
    const href = item.to.replace('$schoolId', schoolId)
    return pathname === href || pathname.startsWith(`${href}/`)
  })
}

export function SchoolNavMain() {
  const { t } = useTranslation('schools')
  const { state, isMobile } = useSidebar()
  const { schoolId, canManage, canManageMembers } = useSchoolLayout()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const membersSectionActive = isMembersPath(pathname, schoolId)
  const [membersOpen, setMembersOpen] = useState(membersSectionActive)
  const [membersMenuOpen, setMembersMenuOpen] = useState(false)
  const membersMenuCloseTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)
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
      titleKey: 'navClasses',
      to: '/s/$schoolId/classes',
      icon: School,
      visible: canManageMembers,
    },
    {
      titleKey: 'navTeams',
      to: '/s/$schoolId/teams',
      icon: LayoutGrid,
      visible: canManageMembers,
    },
    {
      titleKey: 'navInvite',
      to: '/s/$schoolId/invite',
      icon: Link2,
      visible: canManageMembers,
    },
    {
      titleKey: 'navSettings',
      to: '/s/$schoolId/settings',
      icon: Settings,
      visible: canManage,
    },
  ]

  const renderTopItem = (item: TopNavItem) => {
    const href = item.to.replace('$schoolId', schoolId)
    const isActive = pathname === href || pathname.startsWith(`${href}/`)
    const Icon = item.icon
    return (
      <SidebarMenuItem key={item.to}>
        <SidebarMenuButton asChild isActive={isActive} tooltip={t(item.titleKey)}>
          <Link to={item.to} params={{ schoolId }}>
            <Icon />
            <span>{t(item.titleKey)}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t('navSchool')}</SidebarGroupLabel>
      <SidebarMenu>
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
                  {MEMBERS_SUB_ITEMS.map((item) => (
                    <DropdownMenuItem key={item.to} asChild>
                      <Link to={item.to} params={{ schoolId }}>
                        {t(item.titleKey)}
                      </Link>
                    </DropdownMenuItem>
                  ))}
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
                  <SidebarMenuSub>
                    {MEMBERS_SUB_ITEMS.map((item) => {
                      const href = item.to.replace('$schoolId', schoolId)
                      const isActive =
                        pathname === href || pathname.startsWith(`${href}/`)
                      return (
                        <SidebarMenuSubItem key={item.to}>
                          <SidebarMenuSubButton asChild isActive={isActive}>
                            <Link to={item.to} params={{ schoolId }}>
                              <span>{t(item.titleKey)}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )
        ) : null}

        {items.filter((item) => item.visible).map(renderTopItem)}
      </SidebarMenu>
    </SidebarGroup>
  )
}
