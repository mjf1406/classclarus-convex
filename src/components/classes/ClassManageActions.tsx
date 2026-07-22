import { useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import { useRemoveClass, useUpdateClass } from '#/lib/classes'
import type { ClassPublic } from '#/lib/classes'
import { ClassFormCredenza } from '#/components/classes/ClassFormCredenza'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ClassManageActions({ classDoc }: { classDoc: ClassPublic }) {
  const { t } = useTranslation(['classes', 'common'])
  const navigate = useNavigate()
  const updateClass = useUpdateClass()
  const removeClass = useRemoveClass()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const isArchived = classDoc.archivedTime !== undefined

  const handleArchiveToggle = () => {
    const archive = !isArchived
    void updateClass({ classId: classDoc._id, archived: archive })
      .then(() => {
        toast.success(archive ? t('archive') : t('unarchive'))
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : t('updateFailed'))
      })
  }

  const handleDelete = () => {
    const mutationPromise = removeClass({ classId: classDoc._id })
    setConfirmingDelete(false)

    void mutationPromise
      .then(() => {
        toast.success(t('deleteClass'))
        void navigate({ to: '/' })
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : t('deleteFailed'))
      })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label={t('classActions')}
          >
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil />
            {t('edit')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleArchiveToggle}>
            {isArchived ? <ArchiveRestore /> : <Archive />}
            {isArchived ? t('unarchive') : t('archive')}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmingDelete(true)}
          >
            <Trash2 />
            {t('common:delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ClassFormCredenza
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        classDoc={classDoc}
      />

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteClassTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteClassDescription', { name: classDoc.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
            >
              {t('common:delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
