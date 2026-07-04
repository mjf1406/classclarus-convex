import { Link } from '@tanstack/react-router'
import { Button } from '../ui/button'
import { LogIn } from 'lucide-react'

export function SignInButton() {
  return (
    <Link to="/login">
      <Button variant="default">
        <LogIn data-icon="inline-start" className="mr-1" /> Login
      </Button>
    </Link>
  )
}
