import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useMutation } from 'convex/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import { ONE_HOUR } from '#/lib/queryCache'
import { api } from '../../../convex/_generated/api'
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
  Credenza,
  CredenzaBody,
  CredenzaClose,
  CredenzaContent,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from '@/components/ui/credenza'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

type TeamNode = {
  team: {
    _id: string
    name: string
    description: string | null
    parentTeamId?: string
  }
  children: Array<TeamNode>
}

export function SchoolTeamsBoard({ schoolId }: { schoolId: string }) {
  const { t } = useTranslation(['schools', 'common'])
  const queryClient = useQueryClient()
  const createTeam = useMutation(api.tenants.createTeam)
  const deleteTeam = useMutation(api.tenants.deleteTeam)

  const treeQuery = {
    ...convexQuery(api.tenants.listTeamsAsTree, { organizationId: schoolId }),
    gcTime: ONE_HOUR,
  }
  const { data: tree } = useQuery(treeQuery)

  const [formOpen, setFormOpen] = useState(false)
  const [parentTeamId, setParentTeamId] = useState<string | undefined>()
  const [name, setName] = useState('')
  const [deleting, setDeleting] = useState<TeamNode['team'] | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const openCreate = (parentId?: string) => {
    setParentTeamId(parentId)
    setName('')
    setFormOpen(true)
  }

  const handleCreate = () => {
    const trimmed = name.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    void createTeam({
      organizationId: schoolId,
      name: trimmed,
      parentTeamId,
    })
      .then(() => {
        toast.success(t('teamCreated'))
        setFormOpen(false)
        void queryClient.invalidateQueries({ queryKey: treeQuery.queryKey })
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : t('teamSaveFailed'),
        )
      })
      .finally(() => setSubmitting(false))
  }

  const handleDelete = () => {
    if (!deleting) return
    const team = deleting
    setDeleting(null)
    void deleteTeam({ teamId: team._id })
      .then(() => {
        toast.success(t('teamDeleted'))
        void queryClient.invalidateQueries({ queryKey: treeQuery.queryKey })
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : t('teamSaveFailed'),
        )
      })
  }

  const renderNode = (node: TeamNode, depth = 0) => (
    <div
      key={node.team._id}
      className="rounded-xl border bg-card p-4"
      style={{ marginLeft: depth > 0 ? depth * 16 : 0 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{node.team.name}</h3>
          {node.team.description ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {node.team.description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => openCreate(node.team._id)}
          >
            <Plus data-icon="inline-start" />
            {t('createSubTeam')}
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t('common:delete')}
            onClick={() => setDeleting(node.team)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      {node.children.length > 0 ? (
        <div className="mt-3 space-y-3">
          {node.children.map((child) => renderNode(child, depth + 1))}
        </div>
      ) : null}
    </div>
  )

  return (
    <>
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {t('teamsTitle')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('teamsDescription')}
            </p>
          </div>
          <Button type="button" onClick={() => openCreate()}>
            <Plus data-icon="inline-start" />
            {t('createTeam')}
          </Button>
        </div>

        {tree === undefined ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : tree.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
            {t('noTeamsYet')}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {(tree as Array<TeamNode>).map((node) => renderNode(node))}
          </div>
        )}
      </section>

      <Credenza open={formOpen} onOpenChange={setFormOpen}>
        <CredenzaContent>
          <CredenzaHeader>
            <CredenzaTitle>
              {parentTeamId ? t('createSubTeam') : t('createTeam')}
            </CredenzaTitle>
          </CredenzaHeader>
          <CredenzaBody>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="team-name">
                  {t('teamNameLabel')}
                </FieldLabel>
                <Input
                  id="team-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </Field>
            </FieldGroup>
          </CredenzaBody>
          <CredenzaFooter>
            <CredenzaClose asChild>
              <Button type="button" variant="outline">
                {t('common:cancel')}
              </Button>
            </CredenzaClose>
            <Button type="button" disabled={submitting} onClick={handleCreate}>
              {t('common:create')}
            </Button>
          </CredenzaFooter>
        </CredenzaContent>
      </Credenza>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTeamTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? t('deleteTeamDescription', { name: deleting.name })
                : t('common:cannotUndo')}
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
