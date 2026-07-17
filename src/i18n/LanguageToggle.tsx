import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { usePersonalLocale } from './LocaleProvider'
import { APP_LANGUAGES, LANGUAGE_LABELS } from './locales'
import type { AppLanguage } from './locales'

export function LanguageToggle({ className }: { className?: string }) {
  const { t } = useTranslation('common')
  const { personalLanguage, setPersonalLanguage, canChooseLanguage } =
    usePersonalLocale()

  if (!canChooseLanguage) return null

  return (
    <div className={cn(className)}>
      <Select
        value={personalLanguage}
        onValueChange={(next) => setPersonalLanguage(next as AppLanguage)}
      >
        <SelectTrigger
          size="sm"
          className="min-w-28"
          aria-label={t('chooseLanguage')}
        >
          <SelectValue placeholder={t('chooseLanguage')} />
        </SelectTrigger>
        <SelectContent align="end" className="max-h-72">
          {APP_LANGUAGES.map((language) => (
            <SelectItem key={language} value={language}>
              {LANGUAGE_LABELS[language]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
