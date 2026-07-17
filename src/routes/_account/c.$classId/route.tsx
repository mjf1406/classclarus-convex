import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useTranslation } from 'react-i18next'

import { TEN_MINUTES } from '#/lib/queryCache'
import { classLabel } from '#/components/classes/classLabel'
import { ClassLayoutProvider } from '#/components/classes/ClassLayoutContext'
import type { ClassAdminBundle } from '#/components/classes/ClassLayoutContext';
import { ClassSidebar } from '#/components/class-sidebar/ClassSidebar'
import { ClassInsetHeader } from '#/components/class-sidebar/ClassInsetHeader'
import i18n from '#/i18n'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar'

export const Route = createFileRoute('/_account/c/$classId')({
  loader: async ({ context, params, cause }) => {
    if (cause === 'preload') {
      return { classDoc: undefined }
    }
    try {
      const classDoc = await context.queryClient.ensureQueryData(
        convexQuery(api.classes.getClass, {
          classId: params.classId as Id<'classes'>,
        }),
      )
      return { classDoc }
    } catch {
      return { classDoc: undefined }
    }
  },
  head: ({ loaderData }) => {
    const label = classLabel(
      loaderData?.classDoc,
      i18n.t('classes:classFallback'),
    )
    return {
      meta: [
        {
          name: 'description',
          content: i18n.t('classes:docDescription', { label }),
        },
        {
          title: i18n.t('classes:docTitle', { label }),
        },
      ],
    }
  },
  component: ClassLayout,
})

function ClassLayout() {
  const { t } = useTranslation(['classes', 'common'])
  const { classId } = Route.useParams()
  const typedClassId = classId as Id<'classes'>

  const { data: classDoc, isPending } = useQuery({
    ...convexQuery(api.classes.getClass, {
      classId: typedClassId,
    }),
    gcTime: TEN_MINUTES,
  })

  const canManage = classDoc?.canManage === true
  const canManageMembers = classDoc?.canManageMembers === true

  const { data: adminBundle } = useQuery({
    ...convexQuery(
      api.memberships.getClassAdminBundle,
      canManageMembers ? { classId: typedClassId } : 'skip',
    ),
    gcTime: TEN_MINUTES,
  })

  const contextValue = {
    classId: typedClassId,
    classDoc,
    adminBundle: adminBundle as ClassAdminBundle | undefined,
    canManage,
    canManageMembers,
    isPending,
  }

  return (
    <ClassLayoutProvider value={contextValue}>
      <SidebarProvider>
        <ClassSidebar />
        <SidebarInset>
          <ClassInsetHeader />
          <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
            {isPending || classDoc === undefined ? (
              <>
                <Skeleton className="h-10 w-2/3 max-w-md" />
                <Skeleton className="h-5 w-full max-w-lg" />
              </>
            ) : classDoc === null ? (
              <>
                <h1 className="text-3xl font-bold tracking-tight">
                  {t('notFoundTitle')}
                </h1>
                <p className="text-muted-foreground">{t('notFoundDescription')}</p>
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
    </ClassLayoutProvider>
  )
}
