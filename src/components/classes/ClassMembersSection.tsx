import { useState } from 'react'
import { UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useMutation } from 'convex/react'

import type { ClassRole } from '#/lib/classes'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { ClassRoleBadge } from '#/components/classes/ClassRoleBadge'
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
import {
  Card,
  CardAction,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export type ClassMember = {
  userId: Id<'users'>
  name?: string
  email?: string
  role: ClassRole
}

export function ClassMembersSection({
  classId,
  members,
}: {
  classId: Id<'classes'>
  members: Array<ClassMember> | undefined
}) {
  const { t } = useTranslation(['classes', 'common'])
  const removeMember = useMutation(api.memberships.removeMember)
  const [removingUserId, setRemovingUserId] = useState<Id<'users'> | null>(null)
  const [pendingRemove, setPendingRemove] = useState<ClassMember | null>(null)

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
          error instanceof Error
            ? error.message
            : t('memberRemoveFailed'),
        )
      })
      .finally(() => setRemovingUserId(null))
  }

  return (
    <>
      <section>
        <h2 className="text-xl font-semibold tracking-tight">{t('members')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('membersDescription')}
        </p>
        {members === undefined ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Card key={i} size="sm">
                <CardHeader>
                  <div className="min-w-0">
                    <Skeleton className="h-5 w-32" />
                    <div className="mt-2 flex items-center gap-2">
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-4 w-36" />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
            {t('noMembersYet')}
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => {
              const label = memberLabel(member)
              return (
                <li key={member.userId} className="min-w-0">
                  <Card size="sm" className="h-full">
                    <CardHeader className="min-w-0">
                      <div className="min-w-0">
                        <CardTitle
                          className="truncate text-sm font-medium"
                          title={label}
                        >
                          {label}
                        </CardTitle>
                        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                          <ClassRoleBadge role={member.role} />
                          {member.email && member.name ? (
                            <span
                              className="min-w-0 truncate text-xs text-muted-foreground"
                              title={member.email}
                            >
                              {member.email}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <CardAction>
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
                      </CardAction>
                    </CardHeader>
                  </Card>
                </li>
              )
            })}
          </ul>
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
