import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { z } from 'zod'
import { api } from '../../convex/_generated/api'
import { LogoBig } from '@/components/brand/logo'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { SignInWithGoogle } from '@/components/auth/SignInWithGoogle'
import { SignInWithPassword } from '@/components/auth/SignInWithPassword'
import { ModeToggle } from '#/components/theme/mode-toggle'
import { LanguageToggle } from '#/i18n/LanguageToggle'
import { ONE_HOUR } from '@/lib/queryCache'

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  component: RouteComponent,
})

function RouteComponent() {
  const { redirect } = Route.useSearch()
  const [termsAccepted, setTermsAccepted] = useState(false)
  const { t } = useTranslation(['auth', 'common'])

  const { data: providers } = useQuery({
    ...convexQuery(api.authProviders.getAuthProviders, {}),
    gcTime: ONE_HOUR,
  })

  const showPassword = providers?.password === true
  const showGoogle = providers?.google === true

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <LanguageToggle />
        <ModeToggle />
      </div>
      <Card className="w-full max-w-md bg-input/30">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <LogoBig />
          </div>
          <div>
            <CardTitle className="text-2xl">{t('welcomeTitle')}</CardTitle>
            <CardDescription className="mt-2">
              {t('signInToContinue')}{' '}
              <a
                href="https://www.classclarus.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
              >
                {t('learnMore')}
              </a>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 mt-8">
          <div className="flex items-start space-x-2 pb-2">
            <Checkbox
              id="terms-acceptance"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              className="mt-0.5 bg-background"
            />
            <label
              htmlFor="terms-acceptance"
              className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
            >
              {t('agreePrefix')}{' '}
              <a
                href="https://www.classclarus.com/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
                onClick={(e) => e.stopPropagation()}
              >
                {t('privacyPolicy')}
              </a>
              ,{' '}
              <a
                href="https://www.classclarus.com/terms-and-conditions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
                onClick={(e) => e.stopPropagation()}
              >
                {t('termsAndConditions')}
              </a>
              , {t('and')}{' '}
              <a
                href="https://www.classclarus.com/cookie-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
                onClick={(e) => e.stopPropagation()}
              >
                {t('cookiePolicy')}
              </a>
              .
            </label>
          </div>

          {providers === undefined ? (
            <p className="text-center text-sm text-muted-foreground">
              {t('loadingSignIn')}
            </p>
          ) : (
            <>
              {showPassword ? (
                <SignInWithPassword termsAccepted={termsAccepted} />
              ) : null}

              {showPassword && showGoogle ? (
                <p className="text-center text-xs text-muted-foreground">
                  {t('orContinueWith')}
                </p>
              ) : null}

              {showGoogle ? (
                <SignInWithGoogle
                  termsAccepted={termsAccepted}
                  redirectTo={redirect}
                />
              ) : null}

              {!showPassword && showGoogle ? (
                <p className="opacity-50 text-sm">{t('googleOnlyNote')}</p>
              ) : null}
            </>
          )}

          <div className="pt-4 mt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              {t('appFooter')}{' '}
              <a
                href="https://www.classclarus.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
              >
                {t('learnMore')}
              </a>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
