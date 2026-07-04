import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { useCreateClass, useUpdateClass } from '#/lib/classes'
import type { Doc } from '../../../convex/_generated/dataModel'
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
import { Textarea } from '@/components/ui/textarea'

const classFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be 500 characters or less'),
})

type FieldErrors = {
  name?: string
  description?: string
}

type ClassFormMode = 'create' | 'edit'

type ClassFormCredenzaProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
  /** Controls title/actions immediately; classDoc may arrive a frame later on edit. */
  mode?: ClassFormMode
  /** When set in edit mode, form fields are prefilled and update targets this class */
  classDoc?: Doc<'classes'> | null
}

export function ClassFormCredenza({
  open: openProp,
  onOpenChange,
  showTrigger,
  mode = 'create',
  classDoc,
}: ClassFormCredenzaProps) {
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
  const [errors, setErrors] = useState<FieldErrors>({})
  const isSubmittingRef = useRef(false)

  const createClass = useCreateClass()
  const updateClass = useUpdateClass()

  const resetForm = () => {
    setName('')
    setDescription('')
    setErrors({})
  }

  useEffect(() => {
    if (!open) return
    if (classDoc) {
      setName(classDoc.name)
      setDescription(classDoc.description ?? '')
      setErrors({})
    }
  }, [open, classDoc])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      resetForm()
    }
  }

  const submitForm = () => {
    if (isSubmittingRef.current) return
    if (isEdit && !classDoc) return

    const result = classFormSchema.safeParse({ name, description })
    if (!result.success) {
      const fieldErrors = z.flattenError(result.error).fieldErrors
      setErrors({
        name: fieldErrors.name?.[0],
        description: fieldErrors.description?.[0],
      })
      return
    }

    setErrors({})
    isSubmittingRef.current = true

    const editing = classDoc
    const nextName = result.data.name
    const trimmedDescription = result.data.description

    // Fire mutation first so optimistic updates apply, then close immediately.
    const mutationPromise = editing
      ? updateClass({
          classId: editing._id,
          name: nextName,
          description: trimmedDescription,
        })
      : createClass({
          name: nextName,
          ...(trimmedDescription ? { description: trimmedDescription } : {}),
        })

    handleOpenChange(false)

    void mutationPromise
      .then(() => {
        toast.success(editing ? 'Class updated' : 'Class created')
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : editing
              ? 'Failed to update class'
              : 'Failed to create class',
        )
      })
      .finally(() => {
        isSubmittingRef.current = false
      })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submitForm()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Enter') return
    // Enter alone: native submit from inputs; newline in textarea.
    // Ctrl/Cmd+Enter: submit from anywhere, including the textarea.
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
          <Button>
            <Plus data-icon="inline-start" />
            Create Class
          </Button>
        </CredenzaTrigger>
      )}
      <CredenzaContent>
        <CredenzaHeader>
          <CredenzaTitle>
            {isEdit ? 'Edit Class' : 'Create Class'}
          </CredenzaTitle>
          <CredenzaDescription>
            {isEdit
              ? 'Update the class name and description.'
              : 'Add a new class with a name and optional description.'}
          </CredenzaDescription>
        </CredenzaHeader>
        <CredenzaBody>
          <form id={formId} onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
            <FieldGroup>
              <Field data-invalid={!!errors.name || undefined}>
                <FieldLabel htmlFor={`${formId}-name`}>Name</FieldLabel>
                <Input
                  id={`${formId}-name`}
                  name="name"
                  placeholder="Period 3 Biology"
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
              <Field data-invalid={!!errors.description || undefined}>
                <FieldLabel htmlFor={`${formId}-description`}>
                  Description
                </FieldLabel>
                <FieldDescription>Optional</FieldDescription>
                <Textarea
                  id={`${formId}-description`}
                  name="description"
                  placeholder="Optional notes about this class"
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
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>In description,</span>
            <KbdGroup>
              <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd>
            </KbdGroup>
            <span>to submit</span>
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <CredenzaClose asChild>
              <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-initial"
              >
                Cancel
              </Button>
            </CredenzaClose>
            <Button
              type="submit"
              form={formId}
              className="flex-1 sm:flex-initial"
            >
              {isEdit ? 'Save' : 'Create'}
            </Button>
          </div>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  )
}
