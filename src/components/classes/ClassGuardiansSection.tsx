import { useMemo, useState } from 'react'
import { UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'

import { useUnlinkGuardian } from '#/lib/guardians'
import { ONE_HOUR } from '#/lib/queryCache'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type LinkedStudent = {
  orgStudentId: Id<'orgStudents'>
  displayName: string
}

type GuardianRow = {
  guardianUserId: Id<'users'>
  name?: string
  email?: string
  students: Array<LinkedStudent>
}

type PendingUnlink = {
  guardianUserId: Id<'users'>
  guardianName: string
  orgStudentId: Id<'orgStudents'>
  studentName: string
}

export function ClassGuardiansSection({
  classId,
}: {
  classId: Id<'classes'>
}) {
  const { t } = useTranslation(['classes', 'common'])
  const unlinkGuardian = useUnlinkGuardian()
  const [pendingUnlink, setPendingUnlink] = useState<PendingUnlink | null>(null)
  const [unlinkingKey, setUnlinkingKey] = useState<string | null>(null)

  const { data: bundle } = useQuery({
    ...convexQuery(api.memberships.getClassAdminBundle, { classId }),
    gcTime: ONE_HOUR,
  })

  const guardians = useMemo(() => {
    if (!bundle) return undefined
    const byId = new Map<Id<'users'>, GuardianRow>()

    for (const student of bundle.guardianRoster.students) {
      for (const guardian of student.guardians) {
        const existing = byId.get(guardian.guardianUserId)
        if (existing) {
          existing.students.push({
            orgStudentId: student.orgStudentId,
            displayName: student.displayName,
          })
          if (!existing.name && guardian.name) existing.name = guardian.name
          if (!existing.email && guardian.email) existing.email = guardian.email
        } else {
          byId.set(guardian.guardianUserId, {
            guardianUserId: guardian.guardianUserId,
            name: guardian.name,
            email: guardian.email,
            students: [
              {
                orgStudentId: student.orgStudentId,
                displayName: student.displayName,
              },
            ],
          })
        }
      }
    }

    return Array.from(byId.values()).sort((a, b) => {
      const aLabel = a.name ?? a.email ?? a.guardianUserId
      const bLabel = b.name ?? b.email ?? b.guardianUserId
      return aLabel.localeCompare(bLabel)
    })
  }, [bundle])

  const guardianLabel = (guardian: Pick<GuardianRow, 'name' | 'email' | 'guardianUserId'>) =>
    guardian.name ??
    guardian.email ??
    t('common:userFallback', {
      id: guardian.guardianUserId.slice(-6),
    })

  const handleConfirmUnlink = () => {
    if (!pendingUnlink) return
    const pending = pendingUnlink
    setPendingUnlink(null)
    const key = `${pending.guardianUserId}:${pending.orgStudentId}`
    setUnlinkingKey(key)
    void unlinkGuardian({
      classId,
      orgStudentId: pending.orgStudentId,
      guardianUserId: pending.guardianUserId,
    })
      .then(() => {
        toast.success(t('guardianRemoved', { name: pending.guardianName }))
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : t('removeGuardianFailed'),
        )
      })
      .finally(() => setUnlinkingKey(null))
  }

  return (
    <>
      <section>
        <h2 className="text-xl font-semibold tracking-tight">
          {t('guardians')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('guardiansDescription')}
        </p>

        {guardians === undefined ? (
          <div className="mt-4 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colName')}</TableHead>
                  <TableHead>{t('colEmail')}</TableHead>
                  <TableHead>{t('colLinkedStudents')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 3 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : guardians.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
            {t('noGuardiansYet')}
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colName')}</TableHead>
                  <TableHead>{t('colEmail')}</TableHead>
                  <TableHead>{t('colLinkedStudents')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guardians.map((guardian) => {
                  const label = guardianLabel(guardian)
                  return (
                    <TableRow key={guardian.guardianUserId}>
                      <TableCell className="max-w-48 truncate font-medium">
                        {label}
                      </TableCell>
                      <TableCell className="max-w-56 truncate text-muted-foreground">
                        {guardian.email ?? '—'}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <ul className="flex flex-col gap-1">
                          {guardian.students.map((student) => {
                            const key = `${guardian.guardianUserId}:${student.orgStudentId}`
                            return (
                              <li
                                key={student.orgStudentId}
                                className="flex items-center gap-2"
                              >
                                <span className="min-w-0 flex-1 truncate">
                                  {student.displayName}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t('removeGuardianTitle')}
                                  disabled={unlinkingKey === key}
                                  onClick={() =>
                                    setPendingUnlink({
                                      guardianUserId: guardian.guardianUserId,
                                      guardianName: label,
                                      orgStudentId: student.orgStudentId,
                                      studentName: student.displayName,
                                    })
                                  }
                                >
                                  <UserMinus />
                                </Button>
                              </li>
                            )
                          })}
                        </ul>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <AlertDialog
        open={pendingUnlink !== null}
        onOpenChange={(open) => {
          if (!open) setPendingUnlink(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('removeGuardianTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingUnlink
                ? t('removeGuardianDescription', {
                    guardian: pendingUnlink.guardianName,
                    student: pendingUnlink.studentName,
                  })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault()
                handleConfirmUnlink()
              }}
            >
              {t('common:remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
