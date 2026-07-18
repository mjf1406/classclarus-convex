import { Link, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { OrgRoleBadge } from '#/components/schools/OrgRoleBadge'
import { useSchoolLayout } from '#/components/schools/SchoolLayoutContext'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'

function pageTitleKey(pathname: string, schoolId: string): string {
  const prefix = `/s/${schoolId}/`
  const rest = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length)
    : ''
  switch (rest) {
    case 'admins':
      return 'admins'
    case 'teachers':
      return 'teachers'
    case 'teams':
      return 'teamsTitle'
    case 'members/invite':
      return 'inviteTitle'
    case 'invite':
      return 'inviteTitle'
    case 'settings':
      return 'settingsTitle'
    default:
      return 'navMembers'
  }
}

export function SchoolInsetHeader() {
  const { t } = useTranslation(['schools', 'common'])
  const { schoolId, school } = useSchoolLayout()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const titleKey = pageTitleKey(pathname, schoolId)

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">{t('common:home')}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate">
              {school?.name ?? t('schoolFallback')}
            </BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t(titleKey)}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {school ? <OrgRoleBadge role={school.myRole} /> : null}
    </header>
  )
}
