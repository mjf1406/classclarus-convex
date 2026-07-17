import { ChevronDownIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { APP_LANGUAGES, LANGUAGE_LABELS } from '#/i18n/locales'
import type { AppLanguage } from '#/i18n/locales'

type LanguageSelectProps = {
  value: AppLanguage
  onValueChange: (language: AppLanguage) => void
  id?: string
  disabled?: boolean
}

export function LanguageSelect({
  value,
  onValueChange,
  id,
  disabled,
}: LanguageSelectProps) {
  const { t } = useTranslation('common')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id={id}
        disabled={disabled}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-1.5 rounded-4xl border border-input bg-input/30 px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-input/50',
        )}
      >
        <span className="line-clamp-1">
          {LANGUAGE_LABELS[value] ?? t('chooseLanguage')}
        </span>
        <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onValueChange(next as AppLanguage)}
        >
          {APP_LANGUAGES.map((language) => (
            <DropdownMenuRadioItem key={language} value={language}>
              {LANGUAGE_LABELS[language]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
