import { useState, type FormEvent } from 'react'
import { useAuthActions } from '@convex-dev/auth/react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

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
  if (err instanceof Error && err.message) {
    return err.message
  }
  return t('passwordAuthFailed')
}

export function SignInWithPassword({
  termsAccepted = false,
  defaultFlow = 'signIn',
}: SignInWithPasswordProps) {
  const { signIn } = useAuthActions()
  const { t } = useTranslation('auth')
  const [flow, setFlow] = useState<'signIn' | 'signUp'>(defaultFlow)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!termsAccepted) return

    setIsLoading(true)
    setError(null)

    const formData = new FormData(event.currentTarget)
    void signIn('password', formData)
      .then(() => {
        setIsLoading(false)
      })
      .catch((err: unknown) => {
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
