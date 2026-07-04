import { useState } from 'react'
import { useAuthActions } from '@convex-dev/auth/react'
import { Loader2 } from 'lucide-react'
import { Button } from '../ui/button'

interface SignInProps {
  termsAccepted?: boolean
}

export function SignInWithGoogle({ termsAccepted = false }: SignInProps) {
  const { signIn } = useAuthActions()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = () => {
    if (!termsAccepted) return
    setIsLoading(true)

    signIn('google').catch(() => {
      setIsLoading(false)
    })
  }

  return (
    <div className="flex w-full justify-center">
      <Button
        onClick={handleSignIn}
        disabled={!termsAccepted || isLoading}
        variant="outline"
        className={
          isLoading
            ? 'relative p-0 overflow-hidden'
            : 'relative p-0 bg-transparent! dark:bg-transparent! border-0 dark:border-0 hover:bg-transparent! dark:hover:bg-transparent! rounded-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
        }
        aria-label="Sign in with Google"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6! h-6! animate-spin text-muted-foreground" />
          </div>
        )}

        <img
          src="/google/light_sign_in.png"
          alt="Continue with Google"
          className={`dark:hidden ${isLoading ? 'invisible' : ''}`}
        />
        <img
          src="/google/dark_sign_in.png"
          alt="Continue with Google"
          className={`hidden dark:block ${isLoading ? 'invisible' : ''}`}
        />
      </Button>
    </div>
  )
}
