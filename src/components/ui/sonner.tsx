import { useTheme } from 'next-themes'
import { Toaster as Sonner } from 'sonner'
import type { ToasterProps } from 'sonner'
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from 'lucide-react'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            'cn-toast data-[type=default]:!bg-foreground data-[type=default]:!text-background',
          // default: '!bg-foreground !text-background',
          description: '!text-muted-background dark:!text-muted-foreground',
          success: '!bg-green-300 dark:!bg-green-700 !text-foreground',
          info: '!bg-blue-300 dark:!bg-blue-600 dark:!text-foreground',
          warning:
            '!bg-yellow-300 dark:!bg-yellow-600 !text-foreground dark:!text-background',
          error:
            '!bg-red-500 dark:!bg-red-700 !text-foreground dark:!text-background',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
