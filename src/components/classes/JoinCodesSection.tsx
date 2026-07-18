import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import {
  InviteCreateForm,
  InviteList,
} from '#/components/invites/InviteCodesManager'
import { translateClassRole } from '#/i18n/roleLabels'
import type { ClassInviteRole } from '#/lib/inviteCodes'
import {
  classInvitesQueryOptions,
  useCreateClassInvite,
  useRevokeInvite,
} from '#/lib/inviteCodes'
import type { Id } from '../../../convex/_generated/dataModel'

function useInviteClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

export function JoinCodesSection({
  classId,
  isOrgClass,
}: {
  classId: Id<'classes'>
  isOrgClass: boolean
}) {
  const { t } = useTranslation(['classes', 'schools'])
  const now = useInviteClock()
  const invitesQuery = classInvitesQueryOptions(classId, now)
  const { data: invites, isPending } = useQuery(invitesQuery)
  const createInvite = useCreateClassInvite(classId, now)
  const revokeInvite = useRevokeInvite({ classId }, now)
  const [revokingId, setRevokingId] = useState<Id<'inviteCodes'> | null>(null)

  const roleOptions = (
    [
      ...(isOrgClass
        ? []
        : [{ value: 'student' as const, label: translateClassRole(t, 'student') }]),
      {
        value: 'classTeacher' as const,
        label: translateClassRole(t, 'classTeacher'),
      },
      {
        value: 'assistantTeacher' as const,
        label: translateClassRole(t, 'assistantTeacher'),
      },
    ] satisfies Array<{ value: ClassInviteRole; label: string }>
  )

  const defaultRole = isOrgClass ? 'classTeacher' : 'student'

  const roleLabel = (role: string) => {
    if (
      role === 'student' ||
      role === 'classTeacher' ||
      role === 'assistantTeacher' ||
      role === 'creator'
    ) {
      return translateClassRole(t, role)
    }
    return role
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {t('joinCodes')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('joinCodesDescription')}
        </p>
      </div>

      <InviteCreateForm
        roleOptions={roleOptions}
        defaultRole={defaultRole}
        creating={createInvite.isPending}
        onCreate={async (args) => {
          try {
            await createInvite.mutateAsync({
              role: args.role as ClassInviteRole,
              ttlHours: args.ttlHours,
              maxUses: args.maxUses,
            })
            toast.success(t('inviteCreated'))
          } catch (error: unknown) {
            toast.error(
              error instanceof Error
                ? error.message
                : t('inviteCreateFailed'),
            )
          }
        }}
      />

      <div>
        <h3 className="text-sm font-medium">{t('activeInvites')}</h3>
        <div className="mt-3">
          <InviteList
            invites={invites}
            isPending={isPending}
            roleLabel={roleLabel}
            revokingId={revokingId}
            onRevoke={(inviteId) => {
              setRevokingId(inviteId)
              void revokeInvite
                .mutateAsync({ inviteId })
                .then(() => toast.success(t('inviteRevoked')))
                .catch((error: unknown) => {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : t('inviteRevokeFailed'),
                  )
                })
                .finally(() => setRevokingId(null))
            }}
          />
        </div>
      </div>
    </section>
  )
}
