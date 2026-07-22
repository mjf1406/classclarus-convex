import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { Id } from '../../../convex/_generated/dataModel'
import { GroupIconField } from '@/components/groups/GroupIconField'
import {
  useCreateGroup,
  useCreateTeam,
  useUpdateGroup,
  useUpdateTeam,
} from '@/lib/groups'
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
} from '@/components/ui/credenza'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export type GroupEntityDraft =
  | {
      kind: 'group'
      mode: 'create'
      classId: Id<'classes'>
      name: string
      description?: string
      icon?: string
    }
  | {
      kind: 'group'
      mode: 'edit'
      groupId: Id<'classGroups'>
      name: string
      description?: string
      icon?: string
    }
  | {
      kind: 'team'
      mode: 'create'
      groupId: Id<'classGroups'>
      name: string
      description?: string
      icon?: string
    }
  | {
      kind: 'team'
      mode: 'edit'
      teamId: Id<'classTeams'>
      name: string
      description?: string
      icon?: string
    }

type GroupEntityFormCredenzaProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: GroupEntityDraft | null
}

export function GroupEntityFormCredenza({
  open,
  onOpenChange,
  draft,
}: GroupEntityFormCredenzaProps) {
  const { t } = useTranslation(['classes', 'common'])
  const createGroup = useCreateGroup()
  const updateGroup = useUpdateGroup()
  const createTeam = useCreateTeam()
  const updateTeam = useUpdateTeam()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || !draft) return
    setName(draft.name)
    setDescription(draft.description ?? '')
    setIcon(draft.icon ?? null)
    setNameError(undefined)
  }, [open, draft])

  useEffect(() => {
    if (!open) return
    const focusName = () => {
      const input = nameInputRef.current
      if (!input) return
      input.focus()
      input.select()
    }
    const frame = window.requestAnimationFrame(() => {
      focusName()
      window.setTimeout(focusName, 50)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, draft])

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      setName('')
      setDescription('')
      setIcon(null)
      setNameError(undefined)
    }
  }

  const title =
    draft?.kind === 'team'
      ? draft.mode === 'edit'
        ? t('editTeam')
        : t('createTeam')
      : draft?.mode === 'edit'
        ? t('editGroup')
        : t('createGroup')

  const descriptionText =
    draft?.kind === 'team'
      ? t('teamFormDescription')
      : t('groupFormDescription')

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (!draft || submittingRef.current) return

    const trimmed = name.trim()
    if (!trimmed) {
      setNameError(t('nameRequired'))
      return
    }

    submittingRef.current = true
    setIsSubmitting(true)

    const trimmedDescription = description.trim()
    let mutationPromise: Promise<unknown>
    let successKey:
      | 'groupCreated'
      | 'groupUpdated'
      | 'teamCreated'
      | 'teamUpdated'

    if (draft.kind === 'group') {
      if (draft.mode === 'create') {
        mutationPromise = createGroup({
          classId: draft.classId,
          name: trimmed,
          description: trimmedDescription || undefined,
          icon: icon ?? undefined,
        })
        successKey = 'groupCreated'
      } else {
        mutationPromise = updateGroup({
          groupId: draft.groupId,
          name: trimmed,
          description: trimmedDescription ? trimmedDescription : null,
          icon: icon ?? null,
        })
        successKey = 'groupUpdated'
      }
    } else if (draft.mode === 'create') {
      mutationPromise = createTeam({
        groupId: draft.groupId,
        name: trimmed,
        description: trimmedDescription || undefined,
        icon: icon ?? undefined,
      })
      successKey = 'teamCreated'
    } else {
      mutationPromise = updateTeam({
        teamId: draft.teamId,
        name: trimmed,
        description: trimmedDescription ? trimmedDescription : null,
        icon: icon ?? null,
      })
      successKey = 'teamUpdated'
    }

    handleOpenChange(false)

    void mutationPromise
      .then(() => {
        toast.success(t(successKey))
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : t('saveFailed'))
      })
      .finally(() => {
        submittingRef.current = false
        setIsSubmitting(false)
      })
  }

  return (
    <Credenza open={open} onOpenChange={handleOpenChange}>
      <CredenzaContent>
        <CredenzaHeader>
          <CredenzaTitle>{title}</CredenzaTitle>
          <CredenzaDescription>{descriptionText}</CredenzaDescription>
        </CredenzaHeader>
        <form onSubmit={submit}>
          <CredenzaBody>
            <FieldGroup>
              <Field data-invalid={nameError ? true : undefined}>
                <FieldLabel htmlFor="group-entity-name">
                  {t('nameLabel')}
                </FieldLabel>
                <Input
                  ref={nameInputRef}
                  id="group-entity-name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    setNameError(undefined)
                  }}
                  autoFocus
                />
                {nameError ? <FieldError>{nameError}</FieldError> : null}
              </Field>
              <Field>
                <FieldLabel>{t('iconLabel')}</FieldLabel>
                <GroupIconField
                  value={icon}
                  onChange={setIcon}
                  disabled={isSubmitting}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="group-entity-description">
                  {t('descriptionLabel')}
                </FieldLabel>
                <Textarea
                  id="group-entity-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                />
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
              {t('common:save')}
            </Button>
          </CredenzaFooter>
        </form>
      </CredenzaContent>
    </Credenza>
  )
}
