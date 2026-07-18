import { useMemo, useState } from 'react'
import { UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'

import { OrgRoleBadge } from '#/components/schools/OrgRoleBadge'
import {
  useRemoveSchoolMember,
  type SchoolMember,
  type SchoolOrgRole,
} from '#/lib/schools'
import { ONE_HOUR } from '#/lib/queryCache'
import { api } from '../../../convex/_generated/api'
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

const PRINCIPAL_ROLES = new Set<SchoolOrgRole>(['owner', 'principal'])
const TEACHER_ROLES = new Set<SchoolOrgRole>(['teacher'])
const ADMIN_ROLES = new Set<SchoolOrgRole>(['admin'])

export function SchoolStaffMembersSection({
  schoolId,
  roleFilter,
}: {
  schoolId: string
  roleFilter: 'principals' | 'teachers' | 'admins'
}) {
  const { t } = useTranslation(['schools', 'common'])
  const removeMember = useRemoveSchoolMember(schoolId)
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<SchoolMember | null>(null)

  const { data: members } = useQuery({
    ...convexQuery(api.schools.listSchoolMembers, { schoolId }),
    gcTime: ONE_HOUR,
  })

  const filtered = useMemo(() => {
    if (!members) return undefined
    const roles =
      roleFilter === 'principals'
        ? PRINCIPAL_ROLES
        : roleFilter === 'teachers'
          ? TEACHER_ROLES
          : ADMIN_ROLES
    return members.filter((member) => roles.has(member.role))
  }, [members, roleFilter])

  const titleKey =
    roleFilter === 'principals'
      ? 'principals'
      : roleFilter === 'teachers'
        ? 'teachers'
        : 'admins'
  const descriptionKey =
    roleFilter === 'principals'
      ? 'principalsDescription'
      : roleFilter === 'teachers'
        ? 'teachersDescription'
        : 'adminsDescription'
  const emptyKey =
    roleFilter === 'principals'
      ? 'noPrincipalsYet'
      : roleFilter === 'teachers'
        ? 'noTeachersYet'
        : 'noAdminsYet'

  const memberLabel = (member: SchoolMember) =>
    member.name ??
    member.email ??
    t('common:userFallback', { id: member.userId.slice(-6) })

  const handleConfirmRemove = () => {
    if (!pendingRemove) return
    const userId = pendingRemove.userId
    setPendingRemove(null)
    setRemovingUserId(userId)
    void removeMember({ memberUserId: userId })
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

        {filtered === undefined ? (
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
        ) : filtered.length === 0 ? (
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
                {filtered.map((member) => {
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
                        <OrgRoleBadge role={member.role} />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t('common:remove')}
                          disabled={
                            removingUserId === member.userId ||
                            member.role === 'owner'
                          }
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
                : t('common:cannotUndo')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
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
