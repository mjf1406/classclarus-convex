import { Button } from '#/components/ui/button'
import { Authenticated, Unauthenticated, AuthLoading } from 'convex/react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { SignInButton } from '#/components/auth/SignIn'
import { ModeToggle } from '#/components/theme/mode-toggle'
import { UserMenu } from '#/components/auth/UserMenu'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="p-8">
      <ModeToggle className="absolute top-4 right-4" />
      <h1 className="text-4xl font-bold mb-4">Welcome to TanStack Start</h1>
      <AuthLoading>
        <Loader2 size={28} className="animate-spin" />
      </AuthLoading>
      <Unauthenticated>
        <SignInButton />
      </Unauthenticated>
      <Authenticated>
        <UserMenu />
      </Authenticated>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button
          variant="outline"
          onClick={() => toast('Event has been created')}
        >
          Default
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.success('Event has been created')}
        >
          Success
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast.info('Be at the area 10 minutes before the event time')
          }
        >
          Info
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast.warning('Event start time cannot be earlier than 8am')
          }
        >
          Warning
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.error('Event has not been created')}
        >
          Error
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            toast.promise<{ name: string }>(
              () =>
                new Promise((resolve) =>
                  setTimeout(() => resolve({ name: 'Event' }), 2000),
                ),
              {
                loading: 'Loading...',
                success: (data) => `${data.name} has been created`,
                error: 'Error',
              },
            )
          }}
        >
          Promise
        </Button>
        <Button
          onClick={() =>
            toast('Event has been created', {
              description: 'Monday, January 3rd at 6:00pm',
            })
          }
          variant="outline"
          className="w-fit"
        >
          Description
        </Button>
        <Button
          onClick={() =>
            toast('Action time!', {
              description: 'Monday, January 3rd at 6:00pm',
              action: (
                <Button onClick={() => console.log('Action!')}>Action</Button>
              ),
            })
          }
          variant="outline"
          className="w-fit"
        >
          Action
        </Button>
        <Button
          onClick={() =>
            toast('My cancel toast', {
              cancel: (
                <Button onClick={() => console.log('Cancel!')}>Cancel</Button>
              ),
            })
          }
          variant="outline"
          className="w-fit"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
