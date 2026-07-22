import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useTranslation } from 'react-i18next'

import { TEN_MINUTES } from '#/lib/queryCache'
import { SchoolLayoutProvider } from '#/components/schools/SchoolLayoutContext'
import { SchoolSidebar } from '#/components/school-sidebar/SchoolSidebar'
import { SchoolInsetHeader } from '#/components/school-sidebar/SchoolInsetHeader'
import i18n from '#/i18n'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

export const Route = createFileRoute('/_account/s/$schoolId')({
  loader: async ({ context, params, cause }) => {
    if (cause === 'preload') {
      return { school: undefined }
    }
    try {
      const school = await context.queryClient.ensureQueryData(
        convexQuery(api.schools.getSchool, {
          schoolId: params.schoolId,
        }),
      )
      return { school }
    } catch {
      return { school: undefined }
    }
  },
  head: ({ loaderData }) => {
    const label = loaderData?.school?.name ?? i18n.t('schools:schoolFallback')
    return {
      meta: [
        {
          name: 'description',
          content: i18n.t('schools:docDescription', { label }),
        },
        {
          title: i18n.t('schools:docTitle', { label }),
        },
      ],
    }
  },
  component: SchoolLayout,
})

function SchoolLayout() {
  const { t } = useTranslation(['schools', 'common'])
  const { schoolId } = Route.useParams()

  const { data: school, isPending } = useQuery({
    ...convexQuery(api.schools.getSchool, { schoolId }),
    gcTime: TEN_MINUTES,
  })

  const canManage = school?.canManage === true
  const canManageMembers = school?.canManageMembers === true

  return (
    <SchoolLayoutProvider
      value={{
        schoolId,
        school,
        canManage,
        canManageMembers,
        isPending,
      }}
    >
      <SidebarProvider>
        <SchoolSidebar />
        <SidebarInset className="min-w-0">
          <SchoolInsetHeader />
          <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-6">
            {isPending || school === undefined ? (
              <>
                <Skeleton className="h-10 w-2/3 max-w-md" />
                <Skeleton className="h-5 w-full max-w-lg" />
              </>
            ) : school === null ? (
              <>
                <h1 className="text-3xl font-bold tracking-tight">
                  {t('notFoundTitle')}
                </h1>
                <p className="text-muted-foreground">
                  {t('notFoundDescription')}
                </p>
                <Button className="mt-4 w-fit" asChild>
                  <Link to="/">{t('common:goHome')}</Link>
                </Button>
              </>
            ) : (
              <Outlet />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </SchoolLayoutProvider>
  )
}
