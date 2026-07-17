import QRCode from 'react-qr-code'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'

import type { ClassRole } from '#/lib/classes'
import {
  CLASS_ROLE_BADGE_CONFIG,
  ClassRoleBadge,
} from '@/components/classes/ClassRoleBadge'
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
  const roleConfig = CLASS_ROLE_BADGE_CONFIG[role]
  const RoleIcon = roleConfig.icon
  const roleLabel = roleConfig.label
  const joinUrl = getJoinUrl(code)

  const handleCopyCode = () => {
    void navigator.clipboard
      .writeText(code)
      .then(() => toast.success(`${roleLabel} code copied`))
      .catch(() => toast.error('Failed to copy code'))
  }

  const handleCopyLink = () => {
    void navigator.clipboard
      .writeText(joinUrl)
      .then(() => toast.success('Join link copied'))
      .catch(() => toast.error('Failed to copy link'))
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-8 space-y-3">
        <ClassRoleBadge role={role} className="text-base [&_svg]:size-4" />
        <h1 className="font-heading text-3xl font-medium sm:text-4xl">
          {title ?? `Share ${roleLabel.toLowerCase()} join code`}
        </h1>
        <p className="text-lg leading-relaxed text-muted-foreground sm:text-xl">
          {description ??
            `Display this for your class, or share the code / link so others can join as ${roleLabel.toLowerCase()}.`}
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
                Open{' '}
                <span
                  className={cn(
                    'rounded-md border px-2 py-1 font-mono text-xl font-medium break-all sm:text-2xl xl:text-3xl',
                    roleConfig.className,
                  )}
                >
                  {getJoinPageUrl()}
                </span>{' '}
                (or scan the QR).
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
              <span>
                Enter the join code — scanning the QR prefills it for you.
              </span>
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
              <span>
                Tap{' '}
                <span className="font-medium text-foreground">Join class</span>{' '}
                while signed in.
              </span>
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
              {roleLabel} join code
            </div>
            <p className="font-mono text-5xl font-semibold tracking-widest sm:text-6xl xl:text-7xl">
              {formatJoinCodeDisplay(code)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyCode}>
                <Copy className="size-4" />
                Copy code
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                <Copy className="size-4" />
                Copy join link
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
}

export function JoinShareDialog({
  open,
  onOpenChange,
  code,
  role,
}: JoinShareDialogProps) {
  const roleLabel = CLASS_ROLE_BADGE_CONFIG[role].label

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-4 left-4 h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-3xl p-6 sm:max-w-none sm:p-8"
        showCloseButton
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Share {roleLabel.toLowerCase()} join code</DialogTitle>
          <DialogDescription>
            Display this for your class, or share the code / link so others can
            join as {roleLabel.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>
        <JoinSharePanel code={code} role={role} />
      </DialogContent>
    </Dialog>
  )
}
