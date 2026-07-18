import { useCallback, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import i18n from '#/i18n'
import { api } from '../../../convex/_generated/api'
import { JoinCodeInput } from '@/components/classes/JoinCodeInput'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { JOIN_CODE_LENGTH, normalizeJoinCode } from '@/lib/joinCode'

const joinSearchSchema = z.object({
  joinCode: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined
      const normalized = normalizeJoinCode(value).slice(0, JOIN_CODE_LENGTH)
      return normalized.length > 0 ? normalized : undefined
    }),
})

export const Route = createFileRoute('/_account/join')({
  validateSearch: joinSearchSchema,
  component: JoinPage,
  head: () => ({
    meta: [
      {
        name: 'description',
        content: i18n.t('join:docDescription'),
      },
      {
        title: i18n.t('join:docTitle'),
      },
    ],
  }),
})

function JoinPage() {
  const { t } = useTranslation(['join', 'common', 'schools'])
  const navigate = useNavigate()
  const { joinCode: prefilledCode } = Route.useSearch()
  const redeemJoinOrGuardianCode = useMutation(
    api.memberships.redeemJoinOrGuardianCode,
  )

  // Prefill from share/login URLs, but never auto-redeem — require an explicit click.
  const [code, setCode] = useState(prefilledCode ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleJoin = useCallback(async () => {
    if (code.length !== JOIN_CODE_LENGTH) {
      setError(t('codeIncomplete'))
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const result = await redeemJoinOrGuardianCode({ code })
      if (!result.ok) {
        setError(result.error)
        return
      }

      if (result.kind === 'class') {
        const roleLabel =
          result.role === 'student'
            ? t('roleStudent')
            : result.role === 'classTeacher'
              ? t('roleTeacher')
              : result.role === 'assistantTeacher'
                ? t('roleAssistant')
                : result.role
        toast.success(t('joinedAs', { role: roleLabel }))
        await navigate({
          to: '/c/$classId',
          params: { classId: result.classId },
        })
        return
      }

      if (result.kind === 'school') {
        const roleLabel =
          result.role === 'principal'
            ? t('schools:rolePrincipal')
            : result.role === 'teacher'
              ? t('schools:roleTeacher')
              : result.role === 'admin'
                ? t('schools:roleAdmin')
                : result.role
        toast.success(t('joinedAs', { role: roleLabel }))
        await navigate({
          to: '/s/$schoolId/members',
          params: { schoolId: result.schoolId },
        })
        return
      }

      toast.success(t('guardianLinked'))
      await navigate({ to: '/' })
    } catch {
      setError(t('somethingWrong'))
    } finally {
      setIsSubmitting(false)
    }
  }, [code, navigate, redeemJoinOrGuardianCode, t])

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-lg items-center px-6 py-10">
      <Card className="w-full border-primary/20">
        <CardHeader>
          <CardTitle>{t('enterCode')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="join-code">{t('enterCode')}</Label>
            <JoinCodeInput
              id="join-code"
              value={code}
              onChange={(next) => {
                setCode(next)
                if (error) setError(null)
              }}
              onSubmit={() => void handleJoin()}
              disabled={isSubmitting}
              aria-invalid={!!error}
              autoFocus
            />
          </div>

          <Button
            size="lg"
            className="w-full"
            disabled={isSubmitting || code.length !== JOIN_CODE_LENGTH}
            onClick={() => void handleJoin()}
          >
            {isSubmitting ? t('common:loading') : t('submit')}
          </Button>

          {error ? (
            <p className="text-center text-sm text-destructive">{error}</p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
