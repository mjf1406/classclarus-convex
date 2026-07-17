import { useAuthActions } from '@convex-dev/auth/react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import { LogOut } from 'lucide-react'

export function SignOutButton({ className }: { className?: string }) {
  const { signOut } = useAuthActions()
  const { t } = useTranslation('common')
  return (
    <Button
      variant="outline"
      onClick={() => void signOut()}
      className={className}
    >
      <LogOut data-icon="inline-start" className="mr-1" /> {t('signOut')}
    </Button>
  )
}

export function SignOutIcon() {
  const { signOut } = useAuthActions()
  return (
    <Button onClick={() => void signOut()}>
      <LogOut data-icon="inline-start" />
    </Button>
  )
}
