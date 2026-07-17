import { useState } from 'react'
import {
  Copy,
  ExternalLink,
  MoreVertical,
  QrCode,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useMutation } from 'convex/react'

import type { ClassRole } from '#/lib/classes'
import {
  formatJoinCodeDisplay,
  getJoinShareUrl,
  JOIN_CODE_LENGTH,
} from '#/lib/joinCode'
import { JoinShareDialog } from '#/components/classes/JoinShareDialog'
import {
  CLASS_ROLE_BADGE_CONFIG,
} from '#/components/classes/ClassRoleBadge'
import { translateClassRole } from '#/i18n/roleLabels'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type JoinCodeType = 'student' | 'teacher' | 'assistantTeacher'

const JOIN_CODE_ROLE: Record<JoinCodeType, ClassRole> = {
  student: 'student',
  teacher: 'classTeacher',
  assistantTeacher: 'assistantTeacher',
}

export function JoinCodesSection({
  classId,
  codes,
  canRegenerate,
}: {
  classId: Id<'classes'>
  codes:
    | {
        studentCode: string
        teacherCode: string | null
        assistantTeacherCode: string | null
      }
    | undefined
  canRegenerate: boolean
}) {
  const { t } = useTranslation('classes')
  const regenerate = useMutation(api.classes.regenerateJoinCode)
  const [regenerating, setRegenerating] = useState<JoinCodeType | null>(null)
  const [sharing, setSharing] = useState<{
    type: JoinCodeType
    qrOnly: boolean
  } | null>(null)

  const codeFor = (type: JoinCodeType): string | undefined | null => {
    if (codes === undefined) return undefined
    if (type === 'student') return codes.studentCode
    if (type === 'teacher') return codes.teacherCode
    return codes.assistantTeacherCode
  }

  const visibleTypes = (
    ['student', 'teacher', 'assistantTeacher'] as const
  ).filter((type) => {
    if (type === 'student') return true
    if (codes === undefined) return false
    return codeFor(type) !== null
  })

  const sharingCodeRaw = sharing ? codeFor(sharing.type) : null
  const sharingCode =
    typeof sharingCodeRaw === 'string' ? sharingCodeRaw : undefined
  const sharingRole = sharing ? JOIN_CODE_ROLE[sharing.type] : null

  const roleLabelFor = (type: JoinCodeType) =>
    translateClassRole(t, JOIN_CODE_ROLE[type])

  const handleCopy = (type: JoinCodeType) => {
    const code = codeFor(type)
    if (!code) return
    const label = roleLabelFor(type)
    void navigator.clipboard
      .writeText(code)
      .then(() => toast.success(t('codeCopied', { role: label })))
      .catch(() => toast.error(t('codeCopyFailed')))
  }

  const handleRegenerate = (type: JoinCodeType) => {
    setRegenerating(type)
    const label = roleLabelFor(type)
    void regenerate({ classId, codeType: type })
      .then(() => {
        toast.success(t('codeRegenerated', { role: label }))
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : t('codeRegenerateFailed'),
        )
      })
      .finally(() => setRegenerating(null))
  }

  const handleOpenShareWindow = (type: JoinCodeType) => {
    const code = codeFor(type)
    if (!code || code.length !== JOIN_CODE_LENGTH) return

    window.open(
      new URL(getJoinShareUrl(code, JOIN_CODE_ROLE[type])).href,
      '_blank',
      'noopener,noreferrer',
    )
  }

  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">{t('joinCodes')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('joinCodesDescription')}
      </p>
      <div
        className={cn(
          'mt-4 grid gap-3',
          visibleTypes.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
        )}
      >
        {visibleTypes.map((type) => {
          const code = codeFor(type)
          const role = JOIN_CODE_ROLE[type]
          const roleConfig = CLASS_ROLE_BADGE_CONFIG[role]
          const RoleIcon = roleConfig.icon
          const label = roleLabelFor(type)
          return (
            <div
              key={type}
              className={cn('rounded-xl border p-4', roleConfig.className)}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <RoleIcon className="size-3.5" />
                {label}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                {code === undefined || code === null ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <button
                    type="button"
                    className="rounded-md font-mono text-lg font-semibold tracking-widest text-left hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setSharing({ type, qrOnly: false })}
                    aria-label={t('showJoinQr', { role: label })}
                  >
                    {formatJoinCodeDisplay(code)}
                  </button>
                )}
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('showJoinQr', { role: label })}
                    disabled={!code}
                    onClick={() => setSharing({ type, qrOnly: true })}
                  >
                    <QrCode />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('openJoinQrWindow', { role: label })}
                    disabled={!code}
                    onClick={() => handleOpenShareWindow(type)}
                  >
                    <ExternalLink />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('copyRoleCode', { role: label })}
                    disabled={!code}
                    onClick={() => handleCopy(type)}
                  >
                    <Copy />
                  </Button>
                  {canRegenerate ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t('roleCodeActions', { role: label })}
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
                          {t('regenerateCode')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {sharing && sharingCode !== undefined && sharingRole !== null ? (
        <JoinShareDialog
          open
          onOpenChange={(open) => {
            if (!open) setSharing(null)
          }}
          code={sharingCode}
          role={sharingRole}
          qrOnly={sharing.qrOnly}
        />
      ) : null}
    </section>
  )
}
