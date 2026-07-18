import { Link, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { ChevronsUpDown, School } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { OrgRoleBadge } from '#/components/schools/OrgRoleBadge'
import { useSchoolLayout } from '#/components/schools/SchoolLayoutContext'
import { isSchoolArchived, sortSchools } from '#/lib/schools'
import { ONE_HOUR } from '#/lib/queryCache'
import { api } from '../../../convex/_generated/api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

function currentSubpath(pathname: string, schoolId: string): string {
  const prefix = `/s/${schoolId}`
  if (!pathname.startsWith(prefix)) return '/members'
  const rest = pathname.slice(prefix.length)
  return rest.length > 0 ? rest : '/members'
}

export function SchoolSwitcher() {
  const { t, i18n } = useTranslation('schools')
  const { isMobile } = useSidebar()
  const { schoolId, school } = useSchoolLayout()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const { data: schools } = useQuery({
    ...convexQuery(api.schools.listMySchools, {}),
    gcTime: ONE_HOUR,
  })

  const activeSchools = sortSchools(
    (schools ?? []).filter((item) => !isSchoolArchived(item)),
    'nameAsc',
    i18n.language,
  )

  const subpath = currentSubpath(pathname, schoolId)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <School className="size-4" />
              </div>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {school?.name ?? t('schoolFallback')}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {school?.slug}
                </span>
              </div>
              {school ? <OrgRoleBadge role={school.myRole} iconOnly /> : null}
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t('switchSchool')}
            </DropdownMenuLabel>
            {activeSchools.map((item) => {
              const target =
                subpath === '/teams'
                  ? '/s/$schoolId/teams'
                  : subpath === '/invite'
                    ? '/s/$schoolId/invite'
                    : subpath === '/settings'
                      ? '/s/$schoolId/settings'
                      : subpath === '/teachers'
                        ? '/s/$schoolId/teachers'
                        : subpath === '/admins'
                          ? '/s/$schoolId/admins'
                          : '/s/$schoolId/principals'
              return (
                <DropdownMenuItem key={item._id} asChild>
                  <Link to={target} params={{ schoolId: item._id }}>
                    <School className="size-4" />
                    <span className="truncate">{item.name}</span>
                    <OrgRoleBadge
                      role={item.myRole}
                      iconOnly
                      className="ml-auto"
                    />
                  </Link>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
