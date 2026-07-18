import { useEffect, useState } from 'react'
import {
  Copy,
  ExternalLink,
  MoreVertical,
  QrCode,
  RefreshCw,
} from 'lucide-react'
import { useMutation } from 'convex/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import QRCode from 'react-qr-code'

import { OrgRoleBadge } from '#/components/schools/OrgRoleBadge'
import type { SchoolOrgRole } from '#/lib/schools'
import {
  formatJoinCodeDisplay,
  getJoinShareUrl,
  getJoinUrl,
  JOIN_CODE_LENGTH,
} from '#/lib/joinCode'
import { ONE_HOUR } from '#/lib/queryCache'
import { api } from '../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type SchoolJoinCodeType = 'principal' | 'teacher' | 'admin'

const CODE_ROLE: Record<SchoolJoinCodeType, SchoolOrgRole> = {
  principal: 'principal',
  teacher: 'teacher',
  admin: 'admin',
}

const CODE_TYPES: Array<SchoolJoinCodeType> = [
  'principal',
  'teacher',
  'admin',
]

export function SchoolInviteSection({ schoolId }: { schoolId: string }) {
  const { t } = useTranslation(['schools', 'common', 'classes'])
  const queryClient = useQueryClient()
  const regenerate = useMutation(api.schools.regenerateSchoolJoinCode)
  const ensureCodes = useMutation(api.schools.ensureSchoolJoinCodes)

  const codesQuery = {
    ...convexQuery(api.schools.getSchoolJoinCodes, { schoolId }),
    gcTime: ONE_HOUR,
  }
  const { data: codes } = useQuery(codesQuery)

  const [regenerating, setRegenerating] = useState<SchoolJoinCodeType | null>(
    null,
  )
  const [sharing, setSharing] = useState<{
    type: SchoolJoinCodeType
    qrOnly: boolean
  } | null>(null)
  const [ensuring, setEnsuring] = useState(false)

  const roleLabel = (type: SchoolJoinCodeType) => {
    if (type === 'principal') return t('rolePrincipal')
    if (type === 'teacher') return t('roleTeacher')
    return t('roleAdmin')
  }

  const codeFor = (type: SchoolJoinCodeType): string | undefined | null => {
    if (codes === undefined) return undefined
    if (codes === null) return null
    if (type === 'principal') return codes.principalCode
    if (type === 'teacher') return codes.teacherCode
    return codes.adminCode
  }

  useEffect(() => {
    if (ensuring) return
    if (codes === undefined) return
    if (codes !== null) return
    setEnsuring(true)
    void ensureCodes({ schoolId })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: codesQuery.queryKey })
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : t('inviteCodesEnsureFailed'),
        )
      })
      .finally(() => setEnsuring(false))
  }, [codes, ensuring, ensureCodes, schoolId, t, queryClient, codesQuery.queryKey])

  const handleCopy = (type: SchoolJoinCodeType) => {
    const code = codeFor(type)
    if (!code) return
    const label = roleLabel(type)
    void navigator.clipboard
      .writeText(code)
      .then(() => toast.success(t('classes:codeCopied', { role: label })))
      .catch(() => toast.error(t('classes:codeCopyFailed')))
  }

  const handleRegenerate = (type: SchoolJoinCodeType) => {
    setRegenerating(type)
    const label = roleLabel(type)
    void regenerate({ schoolId, codeType: type })
      .then(() => {
        toast.success(t('classes:codeRegenerated', { role: label }))
        void queryClient.invalidateQueries({ queryKey: codesQuery.queryKey })
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : t('classes:codeRegenerateFailed'),
        )
      })
      .finally(() => setRegenerating(null))
  }

  const handleOpenShareWindow = (type: SchoolJoinCodeType) => {
    const code = codeFor(type)
    if (!code || code.length !== JOIN_CODE_LENGTH) return
    window.open(
      new URL(getJoinShareUrl(code, 'classTeacher')).href,
      '_blank',
      'noopener,noreferrer',
    )
  }

  const sharingCodeRaw = sharing ? codeFor(sharing.type) : null
  const sharingCode =
    typeof sharingCodeRaw === 'string' ? sharingCodeRaw : undefined

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {t('inviteTitle')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('inviteDescription')}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {CODE_TYPES.map((type) => {
          const code = codeFor(type)
          const role = CODE_ROLE[type]
          const label = roleLabel(type)
          return (
            <div
              key={type}
              className="rounded-xl border border-border/80 bg-card p-4"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <OrgRoleBadge role={role} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                {code === undefined || code === null ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <button
                    type="button"
                    className="rounded-md font-mono text-lg font-semibold tracking-widest text-left hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setSharing({ type, qrOnly: false })}
                    aria-label={t('classes:showJoinQr', { role: label })}
                  >
                    {formatJoinCodeDisplay(code)}
                  </button>
                )}
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('classes:showJoinQr', { role: label })}
                    disabled={!code}
                    onClick={() => setSharing({ type, qrOnly: true })}
                  >
                    <QrCode />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('classes:openJoinQrWindow', { role: label })}
                    disabled={!code}
                    onClick={() => handleOpenShareWindow(type)}
                  >
                    <ExternalLink />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('classes:copyRoleCode', { role: label })}
                    disabled={!code}
                    onClick={() => handleCopy(type)}
                  >
                    <Copy />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t('classes:roleCodeActions', {
                          role: label,
                        })}
                        disabled={!code}
                      >
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={regenerating === type}
                        onClick={() => handleRegenerate(type)}
                      >
                        <RefreshCw
                          className={
                            regenerating === type ? 'animate-spin' : undefined
                          }
                        />
                        {t('classes:regenerateCode')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {sharing && sharingCode !== undefined ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setSharing(null)
          }}
        >
          <DialogContent className={cn(sharing.qrOnly && 'sm:max-w-sm')}>
            <DialogHeader>
              <DialogTitle>
                {roleLabel(sharing.type)} {t('inviteCodeLabel')}
              </DialogTitle>
              {!sharing.qrOnly ? (
                <DialogDescription>{t('inviteShareHint')}</DialogDescription>
              ) : null}
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="rounded-lg bg-white p-3">
                <QRCode value={getJoinUrl(sharingCode)} size={180} />
              </div>
              {!sharing.qrOnly ? (
                <p className="font-mono text-xl font-semibold tracking-widest">
                  {formatJoinCodeDisplay(sharingCode)}
                </p>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  )
}
