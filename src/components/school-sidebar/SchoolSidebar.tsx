import { useEffect } from 'react'
import { useRouterState } from '@tanstack/react-router'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { SchoolNavMain } from '#/components/school-sidebar/SchoolNavMain'
import { SchoolSwitcher } from '#/components/school-sidebar/SchoolSwitcher'
import { ClassNavUser } from '#/components/class-sidebar/ClassNavUser'

export function SchoolSidebar() {
  const { setOpenMobile } = useSidebar()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SchoolSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SchoolNavMain />
      </SidebarContent>
      <SidebarFooter>
        <ClassNavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
