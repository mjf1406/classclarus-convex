import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import { useClassLayout } from '#/components/classes/ClassLayoutContext'
import { useUpdateClass } from '#/lib/classes'
import { LanguageSelect } from '#/i18n/LanguageSelect'
import {
  coerceClassLanguage,
  DEFAULT_CLASS_LANGUAGE,
} from '#/i18n/locales'
import type { ClassLanguage } from '#/i18n/locales'
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'

export function ClassSettingsSection() {
  const { t } = useTranslation('classes')
  const { classId, classDoc } = useClassLayout()
  const updateClass = useUpdateClass()
  const [isSaving, setIsSaving] = useState(false)

  const currentLanguage = classDoc
    ? coerceClassLanguage(classDoc.language)
    : DEFAULT_CLASS_LANGUAGE

  const handleLanguageChange = (language: ClassLanguage) => {
    if (!classDoc || language === currentLanguage || isSaving) return

    setIsSaving(true)
    void updateClass({ classId, language })
      .then(() => {
        toast.success(t('updated'))
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : t('updateFailed'),
        )
      })
      .finally(() => setIsSaving(false))
  }

  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">
        {t('settingsTitle')}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('settingsDescription')}
      </p>

      <div className="mt-8 border-t border-border pt-8">
        <Field>
          <FieldLabel htmlFor="class-settings-language">
            {t('languageLabel')}
          </FieldLabel>
          <FieldDescription>{t('languageDescription')}</FieldDescription>
          {classDoc === undefined ? (
            <Skeleton className="mt-2 h-9 w-full max-w-xs" />
          ) : (
            <div className="mt-2 max-w-xs">
              <LanguageSelect
                id="class-settings-language"
                allowUserLanguage
                userLanguageLabel={t('languageUserOption')}
                value={currentLanguage}
                onValueChange={handleLanguageChange}
                disabled={isSaving}
              />
            </div>
          )}
        </Field>
      </div>
    </section>
  )
}
