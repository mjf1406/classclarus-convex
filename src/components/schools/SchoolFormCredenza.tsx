import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { useCreateSchool, useUpdateSchool } from '#/lib/schools'
import type { SchoolPublic } from '#/lib/schools'
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Kbd, KbdGroup } from '@/components/ui/kbd'

type FieldErrors = {
  name?: string
  slug?: string
}

type SchoolFormMode = 'create' | 'edit'

type SchoolFormCredenzaProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
  mode?: SchoolFormMode
  school?: SchoolPublic | null
}

export function SchoolFormCredenza({
  open: openProp,
  onOpenChange,
  showTrigger,
  mode = 'create',
  school,
}: SchoolFormCredenzaProps) {
  const { t } = useTranslation(['schools', 'common'])
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
  const [slug, setSlug] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmittingRef = useRef(false)

  const createSchool = useCreateSchool()
  const updateSchool = useUpdateSchool()

  const resetForm = () => {
    setName('')
    setSlug('')
    setErrors({})
  }

  useEffect(() => {
    if (!open) return
    if (school) {
      setName(school.name)
      setSlug(school.slug)
      setErrors({})
    } else if (!isEdit) {
      resetForm()
    }
  }, [open, school, isEdit])

  const schema = z.object({
    name: z.string().trim().min(1, t('nameRequired')),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, t('slugInvalid'))
      .optional()
      .or(z.literal('')),
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (isSubmittingRef.current) return

    const parsed = schema.safeParse({ name, slug })
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (key === 'name' || key === 'slug') {
          fieldErrors[key] = issue.message
        }
      }
      setErrors(fieldErrors)
      return
    }

    setErrors({})
    isSubmittingRef.current = true
    setIsSubmitting(true)

    const payload = {
      name: parsed.data.name,
      slug: parsed.data.slug || undefined,
    }

    const run = isEdit
      ? updateSchool({
          schoolId: school!._id,
          name: payload.name,
          slug: payload.slug,
        })
      : createSchool(payload)

    void run
      .then(() => {
        toast.success(isEdit ? t('schoolUpdated') : t('schoolCreated'))
        setOpen(false)
        if (!isEdit) resetForm()
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : isEdit
              ? t('updateFailed')
              : t('createFailed'),
        )
      })
      .finally(() => {
        isSubmittingRef.current = false
        setIsSubmitting(false)
      })
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      handleSubmit(event as unknown as FormEvent)
    }
  }

  return (
    <Credenza
      open={open}
      onOpenChange={(next) => {
        if (!next && isSubmittingRef.current) return
        setOpen(next)
      }}
    >
      {showCreateTrigger ? (
        <CredenzaTrigger asChild>
          <Button type="button">
            <Plus data-icon="inline-start" />
            {t('createSchool')}
          </Button>
        </CredenzaTrigger>
      ) : null}
      <CredenzaContent>
        <CredenzaHeader>
          <CredenzaTitle>
            {isEdit ? t('editTitle') : t('createTitle')}
          </CredenzaTitle>
          <CredenzaDescription>
            {isEdit ? t('editDescription') : t('createDescription')}
          </CredenzaDescription>
        </CredenzaHeader>
        <form onSubmit={handleSubmit} onKeyDown={onKeyDown}>
          <CredenzaBody>
            <FieldGroup>
              <Field data-invalid={errors.name ? true : undefined}>
                <FieldLabel htmlFor="school-name">{t('nameLabel')}</FieldLabel>
                <Input
                  id="school-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
                {errors.name ? <FieldError>{errors.name}</FieldError> : null}
              </Field>
              <Field data-invalid={errors.slug ? true : undefined}>
                <FieldLabel htmlFor="school-slug">{t('slugLabel')}</FieldLabel>
                <Input
                  id="school-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder={t('slugPlaceholder')}
                />
                {errors.slug ? <FieldError>{errors.slug}</FieldError> : null}
              </Field>
            </FieldGroup>
          </CredenzaBody>
          <CredenzaFooter>
            <CredenzaClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                {t('common:cancel')}
              </Button>
            </CredenzaClose>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? t('common:save') : t('common:create')}
              <KbdGroup className="ml-2 hidden sm:inline-flex">
                <Kbd>⌘</Kbd>
                <Kbd>↵</Kbd>
              </KbdGroup>
            </Button>
          </CredenzaFooter>
        </form>
      </CredenzaContent>
    </Credenza>
  )
}
