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
import type { AppLanguage, ClassLanguage } from '#/i18n/locales'

type LanguageSelectBaseProps = {
  id?: string
  disabled?: boolean
}

type AppLanguageSelectProps = LanguageSelectBaseProps & {
  allowUserLanguage?: false
  value: AppLanguage
  onValueChange: (language: AppLanguage) => void
  userLanguageLabel?: never
}

type ClassLanguageSelectProps = LanguageSelectBaseProps & {
  allowUserLanguage: true
  value: ClassLanguage
  onValueChange: (language: ClassLanguage) => void
  userLanguageLabel: string
}

type LanguageSelectProps = AppLanguageSelectProps | ClassLanguageSelectProps

export function LanguageSelect(props: LanguageSelectProps) {
  const { t } = useTranslation('common')
  const { value, id, disabled } = props

  const displayLabel =
    props.allowUserLanguage === true && value === 'user'
      ? props.userLanguageLabel
      : LANGUAGE_LABELS[value as AppLanguage] ?? t('chooseLanguage')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id={id}
        disabled={disabled}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-1.5 rounded-4xl border border-input bg-input/30 px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-input/50',
        )}
      >
        <span className="line-clamp-1">{displayLabel}</span>
        <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            if (props.allowUserLanguage === true) {
              props.onValueChange(next as ClassLanguage)
            } else {
              props.onValueChange(next as AppLanguage)
            }
          }}
        >
          {props.allowUserLanguage === true ? (
            <DropdownMenuRadioItem value="user">
              {props.userLanguageLabel}
            </DropdownMenuRadioItem>
          ) : null}
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
