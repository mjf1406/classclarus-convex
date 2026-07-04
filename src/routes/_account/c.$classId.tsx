import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { ArrowLeft } from 'lucide-react'

import { TEN_MINUTES } from '#/lib/queryCache'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_account/c/$classId')({
  component: ClassPage,
})

function ClassPage() {
  const { classId } = Route.useParams()
  const { data: classDoc, isPending } = useQuery({
    ...convexQuery(api.classes.getClass, {
      classId: classId as Id<'classes'>,
    }),
    gcTime: TEN_MINUTES,
  })

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-8">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
          <Link to="/">
            <ArrowLeft data-icon="inline-start" />
            Back to classes
          </Link>
        </Button>

        {isPending || classDoc === undefined ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-2/3 max-w-md" />
            <Skeleton className="h-5 w-full max-w-lg" />
          </div>
        ) : classDoc === null ? (
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Class not found
            </h1>
            <p className="text-muted-foreground">
              This class may have been deleted or you don&apos;t have access.
            </p>
            <Button className="mt-4" asChild>
              <Link to="/">Go home</Link>
            </Button>
          </div>
        ) : (
          <header className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {classDoc.name}
            </h1>
            {classDoc.description ? (
              <p className="max-w-2xl text-muted-foreground">
                {classDoc.description}
              </p>
            ) : null}
          </header>
        )}
      </div>
    </div>
  )
}
