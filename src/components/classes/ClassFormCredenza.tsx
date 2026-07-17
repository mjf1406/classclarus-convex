import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { useCreateClass, useUpdateClass } from '#/lib/classes'
import type { ClassPublic } from '#/lib/classes'
import { usePersonalLocale } from '#/i18n/LocaleProvider'
import { LanguageSelect } from '#/i18n/LanguageSelect'
import { coerceAppLanguage } from '#/i18n/locales'
import type { AppLanguage } from '#/i18n/locales'
import { Button } from '@/components/ui/button'
import {
  Credenza,
  CredenzaBody,
  CredenzaClose,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
  CredenzaTrigger,
} from '@/components/ui/credenza'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { NumberInput } from '@/components/ui/number-input'
import { Textarea } from '@/components/ui/textarea'

type FieldErrors = {
  name?: string
  description?: string
  year?: string
}

type ClassFormMode = 'create' | 'edit'

type ClassFormCredenzaProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
  /** Controls title/actions immediately; classDoc may arrive a frame later on edit. */
  mode?: ClassFormMode
  /** When set in edit mode, form fields are prefilled and update targets this class */
  classDoc?: ClassPublic | null
}

export function ClassFormCredenza({
  open: openProp,
  onOpenChange,
  showTrigger,
  mode = 'create',
  classDoc,
}: ClassFormCredenzaProps) {
  const { t } = useTranslation(['classes', 'common'])
  const { personalLanguage } = usePersonalLocale()
  const isEdit = mode === 'edit'
  const showCreateTrigger = showTrigger === true

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : uncontrolledOpen

  const setOpen = (next: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(next)
    }
    onOpenChange?.(next)
  }

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [year, setYear] = useState(() => String(new Date().getFullYear()))
  const [language, setLanguage] = useState<AppLanguage>(personalLanguage)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmittingRef = useRef(false)

  const createClass = useCreateClass()
  const updateClass = useUpdateClass()

  const resetForm = () => {
    setName('')
    setDescription('')
    setYear(String(new Date().getFullYear()))
    setLanguage(personalLanguage)
    setErrors({})
  }

  useEffect(() => {
    if (!open) return
    if (classDoc) {
      setName(classDoc.name)
      setDescription(classDoc.description ?? '')
      setYear(String(classDoc.year))
      setLanguage(coerceAppLanguage(classDoc.language))
      setErrors({})
    } else if (!isEdit) {
      setLanguage(personalLanguage)
    }
  }, [open, classDoc, isEdit, personalLanguage])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      resetForm()
    }
  }

  const submitForm = () => {
    if (isSubmittingRef.current) return
    if (isEdit && !classDoc) return

    const classFormSchema = z.object({
      name: z
        .string()
        .trim()
        .min(1, t('nameRequired'))
        .max(100, t('nameTooLong')),
      description: z
        .string()
        .trim()
        .max(500, t('descriptionTooLong')),
      year: z
        .number({ error: t('yearRequired') })
        .int(t('yearWholeNumber'))
        .min(2000, t('yearMin'))
        .max(2100, t('yearMax')),
    })

    const trimmedYear = year.trim()
    const parsedYear = trimmedYear === '' ? Number.NaN : Number(trimmedYear)
    const result = classFormSchema.safeParse({
      name,
      description,
      year: parsedYear,
    })
    if (!result.success) {
      const fieldErrors = z.flattenError(result.error).fieldErrors
      setErrors({
        name: fieldErrors.name?.[0],
        description: fieldErrors.description?.[0],
        year: fieldErrors.year?.[0],
      })
      return
    }

    setErrors({})
    isSubmittingRef.current = true
    setIsSubmitting(true)

    const editing = classDoc
    const nextName = result.data.name
    const trimmedDescription = result.data.description
    const nextLanguage = language

    const mutationPromise = editing
      ? updateClass({
          classId: editing._id,
          name: nextName,
          description: trimmedDescription,
          language: nextLanguage,
        })
      : createClass({
          name: nextName,
          year: result.data.year,
          language: nextLanguage,
          ...(trimmedDescription ? { description: trimmedDescription } : {}),
        })

    handleOpenChange(false)

    void mutationPromise
      .then(() => {
        toast.success(editing ? t('updated') : t('created'))
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : editing
              ? t('updateFailed')
              : t('createFailed'),
        )
      })
      .finally(() => {
        isSubmittingRef.current = false
        setIsSubmitting(false)
      })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submitForm()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Enter') return
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      submitForm()
    }
  }

  const formId = isEdit ? 'edit-class-form' : 'create-class-form'

  return (
    <Credenza open={open} onOpenChange={handleOpenChange}>
      {showCreateTrigger && (
        <CredenzaTrigger asChild>
          <Button className="w-full sm:w-auto">
            <Plus data-icon="inline-start" />
            {t('createTitle')}
          </Button>
        </CredenzaTrigger>
      )}
      <CredenzaContent>
        <CredenzaHeader>
          <CredenzaTitle>
            {isEdit ? t('editTitle') : t('createTitle')}
          </CredenzaTitle>
          <CredenzaDescription>
            {isEdit ? t('editDescription') : t('createDescription')}
          </CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody>
          <form id={formId} onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
            <FieldGroup>
              <Field data-invalid={!!errors.name || undefined}>
                <FieldLabel htmlFor={`${formId}-name`}>
                  {t('nameLabel')}
                </FieldLabel>
                <Input
                  id={`${formId}-name`}
                  name="name"
                  placeholder={t('namePlaceholder')}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (errors.name) {
                      setErrors((prev) => ({ ...prev, name: undefined }))
                    }
                  }}
                  aria-invalid={!!errors.name}
                  autoFocus
                />
                <FieldError>{errors.name}</FieldError>
              </Field>
              <Field data-invalid={!!errors.year || undefined}>
                <FieldLabel htmlFor={`${formId}-year`}>
                  {t('yearLabel')}
                </FieldLabel>
                {isEdit ? (
                  <FieldDescription>{t('yearImmutable')}</FieldDescription>
                ) : null}
                <NumberInput
                  id={`${formId}-year`}
                  name="year"
                  inputMode="numeric"
                  min={2000}
                  max={2100}
                  step={1}
                  placeholder={String(new Date().getFullYear())}
                  value={year}
                  disabled={isEdit}
                  onChange={(next) => {
                    setYear(next)
                    if (errors.year) {
                      setErrors((prev) => ({ ...prev, year: undefined }))
                    }
                  }}
                  aria-invalid={!!errors.year}
                  inputClassName="w-20 min-w-20"
                />
                <FieldError>{errors.year}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${formId}-language`}>
                  {t('languageLabel')}
                </FieldLabel>
                <FieldDescription>{t('languageDescription')}</FieldDescription>
                <LanguageSelect
                  id={`${formId}-language`}
                  value={language}
                  onValueChange={setLanguage}
                />
              </Field>
              <Field data-invalid={!!errors.description || undefined}>
                <FieldLabel htmlFor={`${formId}-description`}>
                  {t('descriptionLabel')}
                </FieldLabel>
                <FieldDescription>{t('common:optional')}</FieldDescription>
                <Textarea
                  id={`${formId}-description`}
                  name="description"
                  placeholder={t('descriptionPlaceholder')}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value)
                    if (errors.description) {
                      setErrors((prev) => ({
                        ...prev,
                        description: undefined,
                      }))
                    }
                  }}
                  aria-invalid={!!errors.description}
                  rows={3}
                />

                <FieldError>{errors.description}</FieldError>
              </Field>
            </FieldGroup>
          </form>
        </CredenzaBody>
        <CredenzaFooter className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="hidden flex-wrap items-center gap-1.5 text-xs text-muted-foreground md:flex">
            <span>{t('submitHintBefore')}</span>
            <KbdGroup>
              <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd>
            </KbdGroup>
            <span>{t('submitHintAfter')}</span>
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <CredenzaClose asChild>
              <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-initial"
              >
                {t('common:cancel')}
              </Button>
            </CredenzaClose>
            <Button
              type="submit"
              form={formId}
              className="flex-1 sm:flex-initial"
              disabled={isSubmitting || (isEdit && !classDoc)}
            >
              {isEdit ? t('common:save') : t('common:create')}
            </Button>
          </div>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  )
}
