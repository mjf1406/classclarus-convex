import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import i18n from '#/i18n'
import { usePersonalLocale } from '#/i18n/LocaleProvider'
import { LanguageSelect } from '#/i18n/LanguageSelect'
import { ThemeSelect } from '#/components/theme/ThemeSelect'
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@/components/ui/field'

export const Route = createFileRoute('/_account/settings')({
  component: SettingsPage,
  head: () => ({
    meta: [
      {
        name: 'description',
        content: i18n.t('settings:docDescription'),
      },
      {
        title: i18n.t('settings:docTitle'),
      },
    ],
  }),
})

function SettingsPage() {
  const { t } = useTranslation('settings')
  const { personalLanguage, setPersonalLanguage } = usePersonalLocale()

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:p-8">
      <h1 className="text-4xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>

      <div className="mt-8 border-t border-border pt-8">
        <Field>
          <FieldLabel htmlFor="settings-language">
            {t('languageLabel')}
          </FieldLabel>
          <FieldDescription>{t('languageDescription')}</FieldDescription>
          <div className="mt-2 max-w-xs">
            <LanguageSelect
              id="settings-language"
              value={personalLanguage}
              onValueChange={setPersonalLanguage}
            />
          </div>
        </Field>
      </div>

      <div className="mt-8 border-t border-border pt-8">
        <Field>
          <FieldLabel htmlFor="settings-theme">{t('themeLabel')}</FieldLabel>
          <FieldDescription>{t('themeDescription')}</FieldDescription>
          <div className="mt-2 max-w-xs">
            <ThemeSelect id="settings-theme" />
          </div>
        </Field>
      </div>
    </main>
  )
}
