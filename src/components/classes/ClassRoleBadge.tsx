import {
  BookOpen,
  Crown,
  GraduationCap,
  HeartHandshake,
  UserCog,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { ClassDisplayRole } from '#/lib/classes'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type ClassRoleBadgeRole = ClassDisplayRole

export const CLASS_ROLE_BADGE_CONFIG: Record<
  ClassRoleBadgeRole,
  { label: string; icon: LucideIcon; className: string }
> = {
  creator: {
    label: 'Creator',
    icon: Crown,
    className:
      'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  classTeacher: {
    label: 'Co-teacher',
    icon: GraduationCap,
    className: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  assistantTeacher: {
    label: 'Assistant Teacher',
    icon: UserCog,
    className:
      'border-teal-500/20 bg-teal-500/10 text-teal-700 dark:text-teal-300',
  },
  student: {
    label: 'Student',
    icon: BookOpen,
    className:
      'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  guardian: {
    label: 'Guardian',
    icon: HeartHandshake,
    className:
      'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
}

export function ClassRoleBadge({
  role,
  className,
}: {
  role: ClassRoleBadgeRole | undefined
  className?: string
}) {
  if (!role) return null

  const config = CLASS_ROLE_BADGE_CONFIG[role]
  const Icon = config.icon

  return (
    <Badge
      variant="outline"
      className={cn('shrink-0 gap-1', config.className, className)}
    >
      <Icon />
      {config.label}
    </Badge>
  )
}
