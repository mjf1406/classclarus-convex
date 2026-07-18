import { useMemo, useState } from 'react'
import {
  CircleHelp,
  Copy,
  ExternalLink,
  MoreVertical,
  QrCode,
} from 'lucide-react'
import QRCode from 'react-qr-code'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import type { InvitePublic, InviteTtlHours } from '#/lib/inviteCodes'
import {
  INVITE_MAX_USES_PRESETS,
  INVITE_TTL_HOURS,
  MAX_INVITE_USES,
} from '#/lib/inviteCodes'
import {
  formatJoinCodeDisplay,
  getJoinShareUrl,
  getJoinUrl,
  JOIN_CODE_LENGTH,
} from '#/lib/joinCode'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Id } from '../../../convex/_generated/dataModel'

type RoleOption = { value: string; label: string }

export function InviteCreateForm({
  roleOptions,
  defaultRole,
  creating,
  onCreate,
}: {
  roleOptions: Array<RoleOption>
  defaultRole: string
  creating: boolean
  onCreate: (args: {
    role: string
    ttlHours: InviteTtlHours
    maxUses?: number
  }) => Promise<void>
}) {
  const { t } = useTranslation('classes')
  const [role, setRole] = useState(defaultRole)
  const [ttlHours, setTtlHours] = useState<InviteTtlHours>(24)
  const [maxUsesMode, setMaxUsesMode] = useState<
    'unlimited' | 'preset' | 'custom'
  >('unlimited')
  const [presetUses, setPresetUses] = useState<number>(10)
  const [customUses, setCustomUses] = useState('10')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    let maxUses: number | undefined
    if (maxUsesMode === 'preset') {
      maxUses = presetUses
    } else if (maxUsesMode === 'custom') {
      const parsed = Number.parseInt(customUses, 10)
      if (
        !Number.isInteger(parsed) ||
        parsed < 1 ||
        parsed > MAX_INVITE_USES
      ) {
        toast.error(t('maxUsesInvalid', { max: MAX_INVITE_USES }))
        return
      }
      maxUses = parsed
    }
    await onCreate({
      role,
      ttlHours,
      maxUses,
    })
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="space-y-4 rounded-xl border border-border/80 p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="invite-role">{t('roleLabel')}</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger id="invite-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="invite-ttl">{t('ttlLabel')}</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t('ttlHelpAria')}
                  >
                    <CircleHelp className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-sm">
                  {t('ttlHelp')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Select
            value={String(ttlHours)}
            onValueChange={(value) =>
              setTtlHours(Number(value) as InviteTtlHours)
            }
          >
            <SelectTrigger id="invite-ttl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVITE_TTL_HOURS.map((hours) => (
                <SelectItem key={hours} value={String(hours)}>
                  {t('ttlHours', { count: hours })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-max-uses">{t('maxUsesLabel')}</Label>
        <Select
          value={maxUsesMode}
          onValueChange={(value) =>
            setMaxUsesMode(value as 'unlimited' | 'preset' | 'custom')
          }
        >
          <SelectTrigger id="invite-max-uses">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unlimited">{t('maxUsesUnlimited')}</SelectItem>
            <SelectItem value="preset">{t('maxUsesPreset')}</SelectItem>
            <SelectItem value="custom">{t('maxUsesCustom')}</SelectItem>
          </SelectContent>
        </Select>
        {maxUsesMode === 'preset' ? (
          <Select
            value={String(presetUses)}
            onValueChange={(value) => setPresetUses(Number(value))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVITE_MAX_USES_PRESETS.map((uses) => (
                <SelectItem key={uses} value={String(uses)}>
                  {t('maxUsesCount', { count: uses })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {maxUsesMode === 'custom' ? (
          <Input
            type="number"
            min={1}
            max={MAX_INVITE_USES}
            value={customUses}
            onChange={(event) => setCustomUses(event.target.value)}
            aria-label={t('maxUsesCustom')}
          />
        ) : null}
      </div>

      <Button type="submit" disabled={creating}>
        {creating ? t('creating') : t('createInvite')}
      </Button>
    </form>
  )
}

export function InviteList({
  invites,
  isPending,
  roleLabel,
  onRevoke,
  revokingId,
}: {
  invites: Array<InvitePublic> | undefined
  isPending: boolean
  roleLabel: (role: string) => string
  onRevoke: (inviteId: Id<'inviteCodes'>) => void
  revokingId: Id<'inviteCodes'> | null
}) {
  const { t } = useTranslation('classes')
  const [sharing, setSharing] = useState<InvitePublic | null>(null)

  const sorted = useMemo(
    () =>
      invites
        ? [...invites].sort((a, b) => b.createdAt - a.createdAt)
        : undefined,
    [invites],
  )

  const handleCopy = (invite: InvitePublic) => {
    if (invite.code.length !== JOIN_CODE_LENGTH) return
    const label = roleLabel(invite.role)
    void navigator.clipboard
      .writeText(invite.code)
      .then(() => toast.success(t('codeCopied', { role: label })))
      .catch(() => toast.error(t('codeCopyFailed')))
  }

  const handleOpenShareWindow = (invite: InvitePublic) => {
    if (invite.code.length !== JOIN_CODE_LENGTH) return
    window.open(
      new URL(getJoinShareUrl(invite.code, invite.role)).href,
      '_blank',
      'noopener,noreferrer',
    )
  }

  if (isPending || sorted === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('emptyActive')}</p>
    )
  }

  return (
    <div className="space-y-3">
      {sorted.map((invite) => {
        const label = roleLabel(invite.role)
        const pending = invite.code.length !== JOIN_CODE_LENGTH
        return (
          <div
            key={invite._id}
            className="rounded-xl border border-border/80 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {label}
                </p>
                {pending ? (
                  <Skeleton className="mt-1 h-7 w-28" />
                ) : (
                  <button
                    type="button"
                    className="mt-1 rounded-md font-mono text-lg font-semibold tracking-widest text-left hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setSharing(invite)}
                    aria-label={t('showJoinQr', { role: label })}
                  >
                    {formatJoinCodeDisplay(invite.code)}
                  </button>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('expiresAt', {
                    time: new Date(invite.expiresAt).toLocaleString(),
                  })}
                  {' · '}
                  {invite.remainingUses === null
                    ? t('usesUnlimited')
                    : t('usesRemaining', {
                        remaining: invite.remainingUses,
                        max: invite.maxUses ?? 0,
                      })}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('showJoinQr', { role: label })}
                  disabled={pending}
                  onClick={() => setSharing(invite)}
                >
                  <QrCode />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('openJoinQrWindow', { role: label })}
                  disabled={pending}
                  onClick={() => handleOpenShareWindow(invite)}
                >
                  <ExternalLink />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('copyRoleCode', { role: label })}
                  disabled={pending}
                  onClick={() => handleCopy(invite)}
                >
                  <Copy />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('roleCodeActions', { role: label })}
                      disabled={pending}
                    >
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={revokingId === invite._id}
                      onClick={() => onRevoke(invite._id)}
                      className="text-destructive focus:text-destructive"
                    >
                      {t('revokeInvite')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        )
      })}

      {sharing && sharing.code.length === JOIN_CODE_LENGTH ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setSharing(null)
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {roleLabel(sharing.role)} {t('codeLabel')}
              </DialogTitle>
              <DialogDescription>{t('shareHint')}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="rounded-lg bg-white p-3">
                <QRCode value={getJoinUrl(sharing.code)} size={180} />
              </div>
              <p className="font-mono text-xl font-semibold tracking-widest">
                {formatJoinCodeDisplay(sharing.code)}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
