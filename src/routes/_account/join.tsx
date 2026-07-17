import { useCallback, useEffect, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { z } from 'zod'

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
        content: 'Join a class with a join code on ClassClarus',
      },
      {
        title: 'Join a Class | ClassClarus',
      },
    ],
  }),
})

const ROLE_LABELS: Record<string, string> = {
  student: 'student',
  classTeacher: 'co-teacher',
  assistantTeacher: 'assistant teacher',
}

function JoinPage() {
  const navigate = useNavigate()
  const { joinCode: prefilledCode } = Route.useSearch()
  const redeemJoinOrGuardianCode = useMutation(
    api.memberships.redeemJoinOrGuardianCode,
  )

  const [code, setCode] = useState(prefilledCode ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const autoJoinedRef = useRef(false)

  const handleJoin = useCallback(async () => {
    if (code.length !== JOIN_CODE_LENGTH) {
      setError('Enter a complete 8-character join code.')
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
        toast.success(
          `Joined as ${ROLE_LABELS[result.role] ?? result.role}`,
        )
        await navigate({
          to: '/c/$classId',
          params: { classId: result.classId },
        })
        return
      }

      toast.success('Guardian access linked')
      await navigate({ to: '/' })
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [code, navigate, redeemJoinOrGuardianCode])

  // Auto-redeem when arriving from a share/login redirect with a full code.
  useEffect(() => {
    if (
      !prefilledCode ||
      code.length !== JOIN_CODE_LENGTH ||
      isSubmitting ||
      autoJoinedRef.current
    ) {
      return
    }
    autoJoinedRef.current = true
    void handleJoin()
  }, [prefilledCode, code.length, isSubmitting, handleJoin])

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-lg items-center px-6 py-10">
      <Card className="w-full border-primary/20">
        <CardHeader>
          <CardTitle>Enter join code</CardTitle>
          <CardDescription>
            Enter the 8-character class or guardian code your teacher shared.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="join-code">Join code</Label>
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
            {isSubmitting ? 'Joining…' : 'Join'}
          </Button>

          {error ? (
            <p className="text-center text-sm text-destructive">{error}</p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
