import {
  BookOpen,
  Crown,
  GraduationCap,
  HeartHandshake,
  UserCog,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ClassDisplayRole } from '#/lib/classes'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type ClassRoleBadgeRole = ClassDisplayRole

const ROLE_ICON_CONFIG: Record<
  ClassRoleBadgeRole,
  { icon: LucideIcon; className: string; labelKey: string }
> = {
  creator: {
    icon: Crown,
    className:
      'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    labelKey: 'roleCreator',
  },
  classTeacher: {
    icon: GraduationCap,
    className: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    labelKey: 'roleClassTeacher',
  },
  assistantTeacher: {
    icon: UserCog,
    className:
      'border-teal-500/20 bg-teal-500/10 text-teal-700 dark:text-teal-300',
    labelKey: 'roleAssistantTeacher',
  },
  student: {
    icon: BookOpen,
    className:
      'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    labelKey: 'roleStudent',
  },
  guardian: {
    icon: HeartHandshake,
    className:
      'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    labelKey: 'roleGuardian',
  },
}

/** @deprecated Prefer ClassRoleBadge which localizes labels. Kept for icon/color access. */
export const CLASS_ROLE_BADGE_CONFIG: Record<
  ClassRoleBadgeRole,
  { label: string; icon: LucideIcon; className: string }
> = {
  creator: {
    label: 'Creator',
    icon: Crown,
    className: ROLE_ICON_CONFIG.creator.className,
  },
  classTeacher: {
    label: 'Teacher',
    icon: GraduationCap,
    className: ROLE_ICON_CONFIG.classTeacher.className,
  },
  assistantTeacher: {
    label: 'Assistant Teacher',
    icon: UserCog,
    className: ROLE_ICON_CONFIG.assistantTeacher.className,
  },
  student: {
    label: 'Student',
    icon: BookOpen,
    className: ROLE_ICON_CONFIG.student.className,
  },
  guardian: {
    label: 'Guardian',
    icon: HeartHandshake,
    className: ROLE_ICON_CONFIG.guardian.className,
  },
}

export function ClassRoleBadge({
  role,
  className,
  iconOnly = false,
}: {
  role: ClassRoleBadgeRole | undefined
  className?: string
  /** Compact role-colored icon for tight slots (e.g. class switcher). */
  iconOnly?: boolean
}) {
  const { t } = useTranslation('classes')
  if (!role) return null

  const config = ROLE_ICON_CONFIG[role]
  const Icon = config.icon
  const label = t(config.labelKey)

  if (iconOnly) {
    return (
      <Badge
        variant="outline"
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg p-0 [&_svg]:size-4',
          config.className,
          className,
        )}
        aria-label={label}
        title={label}
      >
        <Icon />
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn('shrink-0 gap-1', config.className, className)}
    >
      <Icon />
      {label}
    </Badge>
  )
}
