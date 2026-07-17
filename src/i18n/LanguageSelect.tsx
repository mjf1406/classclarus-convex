import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
    <Select
      value={value}
      onValueChange={(next) => onValueChange(next as AppLanguage)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={t('chooseLanguage')} />
      </SelectTrigger>
      <SelectContent>
        {APP_LANGUAGES.map((language) => (
          <SelectItem key={language} value={language}>
            {LANGUAGE_LABELS[language]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
