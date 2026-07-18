import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

const AUTH_ESTABLISH_TIMEOUT_MS = 8_000

interface SignInWithPasswordProps {
  termsAccepted?: boolean
  /** Prefer sign-up first (e.g. password-only self-host with no accounts yet). */
  defaultFlow?: 'signIn' | 'signUp'
}

function passwordErrorMessage(
  err: unknown,
  flow: 'signIn' | 'signUp',
  t: (key: string) => string,
): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const lower = raw.toLowerCase()
  if (
    flow === 'signIn' &&
    (lower.includes('invalidaccountid') ||
      lower.includes('invalid account') ||
      lower.includes('invalid credentials'))
  ) {
    return t('passwordNoAccount')
  }
  // Prefer the server message — often "Missing environment variable `JWT_…`"
  if (raw.trim().length > 0 && raw !== '[object Object]') {
    return raw
  }
  return t('passwordAuthFailed')
}

export function SignInWithPassword({
  termsAccepted = false,
  defaultFlow = 'signIn',
}: SignInWithPasswordProps) {
  const { signIn } = useAuthActions()
  const { isAuthenticated } = useConvexAuth()
  const { t } = useTranslation('auth')
  const [flow, setFlow] = useState<'signIn' | 'signUp'>(defaultFlow)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const awaitingAuthRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!awaitingAuthRef.current) return
    if (!isAuthenticated) return

    awaitingAuthRef.current = false
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsLoading(false)
  }, [isAuthenticated])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!termsAccepted) return

    setIsLoading(true)
    setError(null)
    awaitingAuthRef.current = false
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    const formData = new FormData(event.currentTarget)
    void signIn('password', formData)
      .then((result) => {
        // tokens: null resolves without throwing — treat as hard failure
        if (result.signingIn !== true) {
          setIsLoading(false)
          setError(t('signInNoTokens'))
          return
        }
        // Wait for useConvexAuth before clearing the spinner (JWT may still be rejected).
        awaitingAuthRef.current = true
        timeoutRef.current = setTimeout(() => {
          if (!awaitingAuthRef.current) return
          awaitingAuthRef.current = false
          timeoutRef.current = null
          setIsLoading(false)
          setError(t('sessionRejected'))
        }, AUTH_ESTABLISH_TIMEOUT_MS)
      })
      .catch((err: unknown) => {
        awaitingAuthRef.current = false
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        setIsLoading(false)
        setError(passwordErrorMessage(err, flow, t))
      })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="auth-email">{t('emailLabel')}</Label>
        <Input
          id="auth-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={!termsAccepted || isLoading}
          placeholder={t('emailPlaceholder')}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="auth-password">{t('passwordLabel')}</Label>
        <Input
          id="auth-password"
          name="password"
          type="password"
          autoComplete={
            flow === 'signUp' ? 'new-password' : 'current-password'
          }
          required
          minLength={8}
          disabled={!termsAccepted || isLoading}
          placeholder={t('passwordPlaceholder')}
        />
      </div>
      <input name="flow" type="hidden" value={flow} />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        className="w-full"
        disabled={!termsAccepted || isLoading}
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : flow === 'signIn' ? (
          t('signIn')
        ) : (
          t('signUp')
        )}
      </Button>
      <button
        type="button"
        className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
        disabled={isLoading}
        onClick={() => {
          setError(null)
          setFlow((current) => (current === 'signIn' ? 'signUp' : 'signIn'))
        }}
      >
        {flow === 'signIn' ? t('signUpInstead') : t('signInInstead')}
      </button>
    </form>
  )
}
