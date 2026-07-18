import {
  Briefcase,
  Crown,
  GraduationCap,
  Shield,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SchoolOrgRole } from '#/lib/schools'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const ROLE_ICON_CONFIG: Record<
  SchoolOrgRole,
  { icon: LucideIcon; className: string; labelKey: string }
> = {
  owner: {
    icon: Crown,
    className:
      'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    labelKey: 'roleOwner',
  },
  admin: {
    icon: Shield,
    className:
      'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300',
    labelKey: 'roleAdmin',
  },
  principal: {
    icon: Briefcase,
    className:
      'border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    labelKey: 'rolePrincipal',
  },
  teacher: {
    icon: GraduationCap,
    className: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    labelKey: 'roleTeacher',
  },
  member: {
    icon: User,
    className:
      'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300',
    labelKey: 'roleMember',
  },
}

export function OrgRoleBadge({
  role,
  className,
  iconOnly = false,
}: {
  role: SchoolOrgRole | undefined
  className?: string
  iconOnly?: boolean
}) {
  const { t } = useTranslation('schools')
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
