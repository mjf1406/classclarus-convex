import { Link } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import { ImageSkeleton } from '@/components/ui/image-skeleton'

export function ErrorPage({ error, reset }: ErrorComponentProps) {
  const message =
    error instanceof Error ? error.message : 'An unexpected error occurred.'

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <ImageSkeleton
              src="/img/under-construction.webp"
              alt="Something went wrong"
              width={327}
              height={341}
            />
          </div>
          <div>
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <AlertCircle className="h-6 w-6 text-destructive" />
              Something went wrong
            </CardTitle>
            <CardDescription className="mt-2">{message}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="default"
            className="w-full"
            size="lg"
            onClick={reset}
          >
            Try again
          </Button>
          <Button asChild variant="outline" className="w-full" size="lg">
            <Link to="/">Go to Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
