import { Link, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { classLabel } from '#/components/classes/classLabel'
import { ClassManageActions } from '#/components/classes/ClassManageActions'
import { useClassLayout } from '#/components/classes/ClassLayoutContext'
import { ClassRoleBadge } from '#/components/classes/ClassRoleBadge'
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

const PAGE_TITLE_KEYS = {
  points: 'navPoints',
  teachers: 'navTeachers',
  assistantTeachers: 'navAssistantTeachers',
  students: 'navStudents',
  guardians: 'navGuardians',
  groups: 'navGroups',
  invite: 'navInvite',
  settings: 'navSettings',
} as const

type ClassSubpage = keyof typeof PAGE_TITLE_KEYS

function getSubpageFromPath(pathname: string): ClassSubpage {
  if (pathname.endsWith('/teachers')) return 'teachers'
  if (pathname.endsWith('/assistant-teachers')) return 'assistantTeachers'
  if (pathname.endsWith('/students')) return 'students'
  if (pathname.endsWith('/guardians')) return 'guardians'
  if (pathname.endsWith('/groups')) return 'groups'
  if (pathname.endsWith('/invite')) return 'invite'
  if (pathname.endsWith('/settings')) return 'settings'
  return 'points'
}

export function ClassInsetHeader() {
  const { t } = useTranslation(['classes', 'home'])
  const { classId, classDoc, canManage } = useClassLayout()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const subpage = getSubpageFromPath(pathname)
  const pageTitle = t(PAGE_TITLE_KEYS[subpage])
  const label = classLabel(classDoc, t('classFallback'))

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex min-w-0 flex-1 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink asChild>
                <Link to="/">{t('home:title')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem className="hidden sm:block">
              <BreadcrumbLink asChild>
                <Link to="/c/$classId/points" params={{ classId }}>
                  {label}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex shrink-0 items-center gap-1 px-4">
        {classDoc && classDoc.myRole ? (
          <ClassRoleBadge role={classDoc.myRole} />
        ) : null}
        {classDoc && canManage ? <ClassManageActions classDoc={classDoc} /> : null}
      </div>
    </header>
  )
}
