import { useMemo, useState } from 'react'
import { UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'

import { ClassRoleBadge } from '#/components/classes/ClassRoleBadge'
import type { ClassRole } from '#/lib/classes'
import {
  type ClassMember,
  useRemoveMember,
} from '#/lib/memberships'
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

const TEACHER_ROLES = new Set<ClassRole>(['creator', 'classTeacher'])
const ASSISTANT_ROLES = new Set<ClassRole>(['assistantTeacher'])

export function ClassStaffMembersSection({
  classId,
  roleFilter,
}: {
  classId: Id<'classes'>
  roleFilter: 'teachers' | 'assistantTeachers'
}) {
  const { t } = useTranslation(['classes', 'common'])
  const removeMember = useRemoveMember()
  const [removingUserId, setRemovingUserId] = useState<Id<'users'> | null>(null)
  const [pendingRemove, setPendingRemove] = useState<ClassMember | null>(null)

  const { data: bundle } = useQuery({
    ...convexQuery(api.memberships.getClassAdminBundle, { classId }),
    gcTime: ONE_HOUR,
  })

  const members = useMemo(() => {
    if (!bundle) return undefined
    const roles =
      roleFilter === 'teachers' ? TEACHER_ROLES : ASSISTANT_ROLES
    return bundle.members.filter((member) => roles.has(member.role))
  }, [bundle, roleFilter])

  const titleKey =
    roleFilter === 'teachers' ? 'teachers' : 'assistantTeachers'
  const descriptionKey =
    roleFilter === 'teachers'
      ? 'teachersDescription'
      : 'assistantTeachersDescription'
  const emptyKey =
    roleFilter === 'teachers' ? 'noTeachersYet' : 'noAssistantTeachersYet'

  const memberLabel = (member: ClassMember) =>
    member.name ??
    member.email ??
    t('common:userFallback', {
      id: member.userId.slice(-6),
    })

  const handleConfirmRemove = () => {
    if (!pendingRemove) return
    const userId = pendingRemove.userId
    setPendingRemove(null)
    setRemovingUserId(userId)
    void removeMember({ classId, userId })
      .then(() => {
        toast.success(t('memberRemoved'))
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : t('memberRemoveFailed'),
        )
      })
      .finally(() => setRemovingUserId(null))
  }

  return (
    <>
      <section>
        <h2 className="text-xl font-semibold tracking-tight">{t(titleKey)}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t(descriptionKey)}</p>

        {members === undefined ? (
          <div className="mt-4 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colName')}</TableHead>
                  <TableHead>{t('colEmail')}</TableHead>
                  <TableHead>{t('colRole')}</TableHead>
                  <TableHead className="w-12" />
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
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="size-8" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : members.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
            {t(emptyKey)}
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colName')}</TableHead>
                  <TableHead>{t('colEmail')}</TableHead>
                  <TableHead>{t('colRole')}</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{t('common:remove')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const label = memberLabel(member)
                  return (
                    <TableRow key={member.userId}>
                      <TableCell className="max-w-48 truncate font-medium">
                        {label}
                      </TableCell>
                      <TableCell className="max-w-56 truncate text-muted-foreground">
                        {member.email ?? '—'}
                      </TableCell>
                      <TableCell>
                        <ClassRoleBadge role={member.role} />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t('common:remove')}
                          disabled={removingUserId === member.userId}
                          onClick={() => setPendingRemove(member)}
                        >
                          <UserMinus />
                        </Button>
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
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('removeMemberTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove
                ? t('removeMemberDescription', {
                    name: memberLabel(pendingRemove),
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
                handleConfirmRemove()
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
