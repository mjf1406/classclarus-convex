import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
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
import { ModeToggle } from '#/components/theme/mode-toggle'

export const Route = createFileRoute('/login')({
  component: RouteComponent,
})

function RouteComponent() {
  const [termsAccepted, setTermsAccepted] = useState(false)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <ModeToggle className="absolute top-4 right-4" />
      <Card className="w-full max-w-md bg-input/30">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <LogoBig />
          </div>
          <div>
            <CardTitle className="text-2xl">Welcome to ClassClarus</CardTitle>
            <CardDescription className="mt-2">
              Sign in to continue.{' '}
              <a
                href="https://www.classclarus.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
              >
                Learn more about what we do
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
              I agree to the{' '}
              <a
                href="https://www.classclarus.com/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
                onClick={(e) => e.stopPropagation()}
              >
                privacy policy
              </a>
              ,{' '}
              <a
                href="https://www.classclarus.com/terms-and-conditions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
                onClick={(e) => e.stopPropagation()}
              >
                terms and conditions
              </a>
              , and{' '}
              <a
                href="https://www.classclarus.com/cookie-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
                onClick={(e) => e.stopPropagation()}
              >
                cookie policy
              </a>
              .
            </label>
          </div>
          <SignInWithGoogle termsAccepted={termsAccepted} />
          <div className="pt-4 mt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              This is the ClassClarus app.{' '}
              <a
                href="https://www.classclarus.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
              >
                Learn more about what we do
              </a>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
