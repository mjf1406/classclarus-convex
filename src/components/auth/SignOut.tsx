import { useAuthActions } from '@convex-dev/auth/react'
import { Button } from '../ui/button'
import { LogOut } from 'lucide-react'

export function SignOutButton() {
  const { signOut } = useAuthActions()
  return (
    <Button onClick={() => void signOut()}>
      <LogOut data-icon="inline-start" className="mr-1" /> Sign out
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
