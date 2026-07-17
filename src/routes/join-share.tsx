import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import i18n from '#/i18n'
import { JoinSharePanel } from '@/components/classes/JoinShareDialog'
import type { ClassRole } from '@/lib/classes'
import { JOIN_CODE_LENGTH, normalizeJoinCode } from '@/lib/joinCode'

const shareSearchSchema = z.object({
  joinCode: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined
      const normalized = normalizeJoinCode(value).slice(0, JOIN_CODE_LENGTH)
      return normalized.length > 0 ? normalized : undefined
    }),
  role: z
    .union([
      z.literal('student'),
      z.literal('classTeacher'),
      z.literal('assistantTeacher'),
    ])
    .optional()
    .catch('student'),
})

export const Route = createFileRoute('/join-share')({
  validateSearch: shareSearchSchema,
  component: JoinSharePage,
  head: () => ({
    meta: [
      {
        title: i18n.t('join:shareDocTitle'),
      },
    ],
  }),
})

function JoinSharePage() {
  const { t } = useTranslation('join')
  const { joinCode, role } = Route.useSearch()
  const shareRole = (role ?? 'student') as ClassRole

  if (!joinCode || joinCode.length !== JOIN_CODE_LENGTH) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background p-6">
        <p className="text-center text-lg text-muted-foreground">
          {t('invalidShareLink')}
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-background p-6 sm:p-8">
      <JoinSharePanel code={joinCode} role={shareRole} />
    </main>
  )
}
