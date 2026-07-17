import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { buttonVariants } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
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
          aria-label={t('chooseLanguage')}
          className={buttonVariants({
            variant: 'outline',
            size: 'icon',
            className: 'justify-center p-0 [&_svg:last-child]:hidden',
          })}
        >
          <Languages className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">{t('chooseLanguage')}</span>
        </SelectTrigger>
        <SelectContent
          position="popper"
          align="end"
          className="max-h-72 min-w-48 [&_[data-position=popper]]:h-auto! [&_[data-position=popper]]:min-w-48"
        >
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
