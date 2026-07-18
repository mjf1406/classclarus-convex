import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import {
  InviteCreateForm,
  InviteList,
} from '#/components/invites/InviteCodesManager'
import type { SchoolInviteRole } from '#/lib/inviteCodes'
import {
  schoolInvitesQueryOptions,
  useCreateSchoolInvite,
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

export function SchoolInviteSection({ schoolId }: { schoolId: string }) {
  const { t } = useTranslation(['schools', 'classes'])
  const now = useInviteClock()
  const invitesQuery = schoolInvitesQueryOptions(schoolId, now)
  const { data: invites, isPending } = useQuery(invitesQuery)
  const createInvite = useCreateSchoolInvite(schoolId, now)
  const revokeInvite = useRevokeInvite({ schoolId }, now)
  const [revokingId, setRevokingId] = useState<Id<'inviteCodes'> | null>(null)

  const roleOptions: Array<{ value: SchoolInviteRole; label: string }> = [
    { value: 'principal', label: t('rolePrincipal') },
    { value: 'vicePrincipal', label: t('roleVicePrincipal') },
    {
      value: 'assistantVicePrincipal',
      label: t('roleAssistantVicePrincipal'),
    },
    { value: 'teacher', label: t('roleTeacher') },
    { value: 'admin', label: t('roleAdmin') },
  ]

  const roleLabel = (role: string) => {
    if (role === 'principal') return t('rolePrincipal')
    if (role === 'vicePrincipal') return t('roleVicePrincipal')
    if (role === 'assistantVicePrincipal') return t('roleAssistantVicePrincipal')
    if (role === 'teacher') return t('roleTeacher')
    if (role === 'admin') return t('roleAdmin')
    return role
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {t('inviteTitle')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('inviteDescription')}
        </p>
      </div>

      <InviteCreateForm
        roleOptions={roleOptions}
        defaultRole="teacher"
        creating={createInvite.isPending}
        onCreate={async (args) => {
          try {
            await createInvite.mutateAsync({
              role: args.role as SchoolInviteRole,
              ttlHours: args.ttlHours,
              maxUses: args.maxUses,
            })
            toast.success(t('classes:inviteCreated'))
          } catch (error: unknown) {
            toast.error(
              error instanceof Error
                ? error.message
                : t('classes:inviteCreateFailed'),
            )
          }
        }}
      />

      <div>
        <h3 className="text-sm font-medium">{t('classes:activeInvites')}</h3>
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
                .then(() => toast.success(t('classes:inviteRevoked')))
                .catch((error: unknown) => {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : t('classes:inviteRevokeFailed'),
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
