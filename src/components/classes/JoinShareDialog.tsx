import QRCode from 'react-qr-code'
import { Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { ClassRole } from '#/lib/classes'
import {
  CLASS_ROLE_BADGE_CONFIG,
  ClassRoleBadge,
} from '@/components/classes/ClassRoleBadge'
import { translateClassRole } from '#/i18n/roleLabels'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  formatJoinCodeDisplay,
  getJoinPageUrl,
  getJoinUrl,
} from '@/lib/joinCode'
import { copyTextToClipboard } from '#/lib/clipboard'
import { cn } from '@/lib/utils'

type JoinSharePanelProps = {
  code: string
  role: ClassRole
  title?: string
  description?: string
}

export function JoinSharePanel({
  code,
  role,
  title,
  description,
}: JoinSharePanelProps) {
  const { t } = useTranslation('classes')
  const roleConfig = CLASS_ROLE_BADGE_CONFIG[role]
  const RoleIcon = roleConfig.icon
  const roleLabel = translateClassRole(t, role).toLowerCase()
  const joinUrl = getJoinUrl(code)

  const handleCopyCode = () => {
    void copyTextToClipboard(code)
      .then(() =>
        toast.success(t('codeCopied', { role: translateClassRole(t, role) })),
      )
      .catch(() => toast.error(t('codeCopyFailed')))
  }

  const handleCopyLink = () => {
    void copyTextToClipboard(joinUrl)
      .then(() => toast.success(t('joinLinkCopied')))
      .catch(() => toast.error(t('linkCopyFailed')))
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-8 space-y-3">
        <ClassRoleBadge role={role} className="text-base [&_svg]:size-4" />
        <h1 className="font-heading text-3xl font-medium sm:text-4xl">
          {title ?? t('shareJoinCodeTitle', { role: roleLabel })}
        </h1>
        <p className="text-lg leading-relaxed text-muted-foreground sm:text-xl">
          {description ?? t('shareJoinCodeDescription', { role: roleLabel })}
        </p>
      </div>

      <div className="grid flex-1 gap-10 lg:grid-cols-2 lg:items-center">
        <div className="space-y-10">
          <ol className="space-y-6 text-xl leading-relaxed text-muted-foreground sm:text-2xl xl:text-3xl">
            <li className="flex gap-4">
              <span
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-full border text-lg font-bold sm:size-12 sm:text-xl',
                  roleConfig.className,
                )}
              >
                1
              </span>
              <span>
                {t('shareStep1Before')}{' '}
                <span
                  className={cn(
                    'rounded-md border px-2 py-1 font-mono text-xl font-medium break-all sm:text-2xl xl:text-3xl',
                    roleConfig.className,
                  )}
                >
                  {getJoinPageUrl()}
                </span>{' '}
                {t('shareStep1After')}
              </span>
            </li>
            <li className="flex gap-4">
              <span
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-full border text-lg font-bold sm:size-12 sm:text-xl',
                  roleConfig.className,
                )}
              >
                2
              </span>
              <span>{t('shareStep2')}</span>
            </li>
            <li className="flex gap-4">
              <span
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-full border text-lg font-bold sm:size-12 sm:text-xl',
                  roleConfig.className,
                )}
              >
                3
              </span>
              <span>{t('shareStep3')}</span>
            </li>
          </ol>

          <div
            className={cn(
              'space-y-4 rounded-2xl border p-5 sm:p-6',
              roleConfig.className,
            )}
          >
            <div className="flex items-center gap-2 text-lg font-medium sm:text-xl">
              <RoleIcon className="size-5 sm:size-6" />
              {t('roleJoinCode', { role: translateClassRole(t, role) })}
            </div>
            <p className="font-mono text-5xl font-semibold tracking-widest sm:text-6xl xl:text-7xl">
              {formatJoinCodeDisplay(code)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyCode}>
                <Copy className="size-4" />
                {t('copyCode')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                <Copy className="size-4" />
                {t('copyJoinLink')}
              </Button>
            </div>
          </div>
        </div>

        <div
          className={cn(
            'flex items-center justify-center rounded-3xl border p-6 sm:p-8',
            roleConfig.className,
          )}
        >
          <QRCode
            value={joinUrl}
            size={520}
            bgColor="transparent"
            fgColor="currentColor"
            className="h-auto w-full max-w-130"
          />
        </div>
      </div>
    </div>
  )
}

type JoinShareDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  code: string
  role: ClassRole
  qrOnly?: boolean
}

export function JoinShareDialog({
  open,
  onOpenChange,
  code,
  role,
  qrOnly = false,
}: JoinShareDialogProps) {
  const { t } = useTranslation('classes')
  const roleConfig = CLASS_ROLE_BADGE_CONFIG[role]
  const roleLabel = translateClassRole(t, role)
  const roleLabelLower = roleLabel.toLowerCase()
  const joinUrl = getJoinUrl(code)

  if (qrOnly) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xs gap-0 p-4 sm:max-w-sm">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {t('joinQrTitle', { role: roleLabel })}
            </DialogTitle>
            <DialogDescription>
              {t('joinQrDescription', { role: roleLabelLower })}
            </DialogDescription>
          </DialogHeader>
          <div
            className={cn(
              'flex items-center justify-center rounded-2xl border p-4',
              roleConfig.className,
            )}
          >
            <QRCode
              value={joinUrl}
              size={280}
              bgColor="transparent"
              fgColor="currentColor"
              className="h-auto w-full"
            />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'top-4 left-4 h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-3xl p-6 sm:max-w-none sm:p-8',
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            {t('shareJoinCodeTitle', { role: roleLabelLower })}
          </DialogTitle>
          <DialogDescription>
            {t('shareJoinCodeDescription', { role: roleLabelLower })}
          </DialogDescription>
        </DialogHeader>

        <JoinSharePanel code={code} role={role} />
      </DialogContent>
    </Dialog>
  )
}
