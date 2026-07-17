import type { TFunction } from 'i18next'

import type { ClassDisplayRole } from '#/lib/classes'

const ROLE_KEYS: Record<ClassDisplayRole, string> = {
  creator: 'roleCreator',
  classTeacher: 'roleClassTeacher',
  assistantTeacher: 'roleAssistantTeacher',
  student: 'roleStudent',
  guardian: 'roleGuardian',
}

/** Localized class role label (classes namespace). */
export function translateClassRole(
  t: TFunction<'classes'>,
  role: ClassDisplayRole | string | undefined,
  options?: { shortAssistant?: boolean },
): string {
  if (!role) return ''
  if (role === 'assistantTeacher' && options?.shortAssistant) {
    return t('roleAssistantShort')
  }
  const key = ROLE_KEYS[role as ClassDisplayRole]
  return key ? t(key) : role
}
