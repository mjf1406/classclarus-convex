import { createFileRoute } from '@tanstack/react-router'
import { ModeToggle } from '#/components/theme/mode-toggle'
import { UserMenu } from '#/components/auth/UserMenu'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="p-8">
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <UserMenu />
        <ModeToggle />
      </div>
      <h1 className="text-4xl font-bold mb-4">My Classes</h1>
    </div>
  )
}
