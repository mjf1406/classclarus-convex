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
import { ClassNavMain } from '#/components/class-sidebar/ClassNavMain'
import { ClassTeamSwitcher } from '#/components/class-sidebar/ClassTeamSwitcher'
import { ClassNavUser } from '#/components/class-sidebar/ClassNavUser'

export function ClassSidebar() {
  const { setOpenMobile } = useSidebar()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <ClassTeamSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <ClassNavMain />
      </SidebarContent>
      <SidebarFooter>
        <ClassNavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
