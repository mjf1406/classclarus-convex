import { ChevronDownIcon, Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useTheme } from './theme-provider'

const THEME_OPTIONS = ['light', 'dark', 'system'] as const

type ThemeOption = (typeof THEME_OPTIONS)[number]

const THEME_ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} satisfies Record<ThemeOption, typeof Sun>

type ThemeSelectProps = {
  id?: string
  disabled?: boolean
}

export function ThemeSelect({ id, disabled }: ThemeSelectProps) {
  const { t } = useTranslation('common')
  const { theme, setTheme } = useTheme()

  const themeLabels: Record<ThemeOption, string> = {
    light: t('themeLight'),
    dark: t('themeDark'),
    system: t('themeSystem'),
  }

  const ActiveIcon = THEME_ICONS[theme]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id={id}
        disabled={disabled}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-1.5 rounded-4xl border border-input bg-input/30 px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-input/50',
        )}
      >
        <span className="flex items-center gap-2">
          <ActiveIcon className="size-4 text-muted-foreground" />
          <span className="line-clamp-1">{themeLabels[theme]}</span>
        </span>
        <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(next) => setTheme(next as ThemeOption)}
        >
          {THEME_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {themeLabels[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
