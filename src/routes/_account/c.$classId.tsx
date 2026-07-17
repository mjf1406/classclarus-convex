import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Copy,
  ExternalLink,
  MoreVertical,
  Pencil,
  QrCode,
  RefreshCw,
  Trash2,
  UserMinus,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import { TEN_MINUTES } from '#/lib/queryCache'
import { useRemoveClass, useUpdateClass } from '#/lib/classes'
import type { ClassPublic, ClassRole } from '#/lib/classes'
import {
  formatJoinCodeDisplay,
  getJoinShareUrl,
  JOIN_CODE_LENGTH,
} from '#/lib/joinCode'
import { ClassFormCredenza } from '#/components/classes/ClassFormCredenza'
import { ClassStudentsSection } from '#/components/classes/ClassStudentsSection'
import {
  CLASS_ROLE_BADGE_CONFIG,
  ClassRoleBadge,
} from '#/components/classes/ClassRoleBadge'
import { JoinShareDialog } from '#/components/classes/JoinShareDialog'
import i18n from '#/i18n'
import { translateClassRole } from '#/i18n/roleLabels'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useMutation } from 'convex/react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

function classLabel(
  classDoc: ClassPublic | null | undefined,
  fallback: string,
) {
  if (classDoc == null) return fallback
  return `(${classDoc.year}) ${classDoc.name}`
}

export const Route = createFileRoute('/_account/c/$classId')({
  loader: async ({ context, params }) => {
    try {
      const classDoc = await context.queryClient.ensureQueryData(
        convexQuery(api.classes.getClass, {
          classId: params.classId as Id<'classes'>,
        }),
      )
      return { classDoc }
    } catch {
      // Auth may not be ready on cold load; useQuery retries after auth.
      return { classDoc: undefined }
    }
  },
  head: ({ loaderData }) => {
    const label = classLabel(
      loaderData?.classDoc,
      i18n.t('classes:classFallback'),
    )
    return {
      meta: [
        {
          name: 'description',
          content: i18n.t('classes:docDescription', { label }),
        },
        {
          title: i18n.t('classes:docTitle', { label }),
        },
      ],
    }
  },
  component: ClassPage,
})

type JoinCodeType = 'student' | 'teacher' | 'assistantTeacher'

const JOIN_CODE_ROLE: Record<JoinCodeType, ClassRole> = {
  student: 'student',
  teacher: 'classTeacher',
  assistantTeacher: 'assistantTeacher',
}

function JoinCodesSection({
  classId,
  codes,
  canRegenerate,
}: {
  classId: Id<'classes'>
  codes:
    | {
        studentCode: string
        teacherCode: string | null
        assistantTeacherCode: string | null
      }
    | undefined
  canRegenerate: boolean
}) {
  const { t } = useTranslation('classes')
  const regenerate = useMutation(api.classes.regenerateJoinCode)
  const [regenerating, setRegenerating] = useState<JoinCodeType | null>(null)
  const [sharing, setSharing] = useState<{
    type: JoinCodeType
    qrOnly: boolean
  } | null>(null)

  const codeFor = (type: JoinCodeType): string | undefined | null => {
    if (codes === undefined) return undefined
    if (type === 'student') return codes.studentCode
    if (type === 'teacher') return codes.teacherCode
    return codes.assistantTeacherCode
  }

  const visibleTypes = (
    ['student', 'teacher', 'assistantTeacher'] as const
  ).filter((type) => {
    if (type === 'student') return true
    if (codes === undefined) return false
    return codeFor(type) !== null
  })

  const sharingCodeRaw = sharing ? codeFor(sharing.type) : null
  const sharingCode =
    typeof sharingCodeRaw === 'string' ? sharingCodeRaw : undefined
  const sharingRole = sharing ? JOIN_CODE_ROLE[sharing.type] : null

  const roleLabelFor = (type: JoinCodeType) =>
    translateClassRole(t, JOIN_CODE_ROLE[type])

  const handleCopy = (type: JoinCodeType) => {
    const code = codeFor(type)
    if (!code) return
    const label = roleLabelFor(type)
    void navigator.clipboard
      .writeText(code)
      .then(() => toast.success(t('codeCopied', { role: label })))
      .catch(() => toast.error(t('codeCopyFailed')))
  }

  const handleRegenerate = (type: JoinCodeType) => {
    setRegenerating(type)
    const label = roleLabelFor(type)
    void regenerate({ classId, codeType: type })
      .then(() => {
        toast.success(t('codeRegenerated', { role: label }))
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : t('codeRegenerateFailed'),
        )
      })
      .finally(() => setRegenerating(null))
  }

  const handleOpenShareWindow = (type: JoinCodeType) => {
    const code = codeFor(type)
    if (!code || code.length !== JOIN_CODE_LENGTH) return

    window.open(
      new URL(getJoinShareUrl(code, JOIN_CODE_ROLE[type])).href,
      '_blank',
      'noopener,noreferrer',
    )
  }

  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight">{t('joinCodes')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('joinCodesDescription')}
      </p>
      <div
        className={cn(
          'mt-4 grid gap-3',
          visibleTypes.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
        )}
      >
        {visibleTypes.map((type) => {
          const code = codeFor(type)
          const role = JOIN_CODE_ROLE[type]
          const roleConfig = CLASS_ROLE_BADGE_CONFIG[role]
          const RoleIcon = roleConfig.icon
          const label = roleLabelFor(type)
          return (
            <div
              key={type}
              className={cn('rounded-xl border p-4', roleConfig.className)}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <RoleIcon className="size-3.5" />
                {label}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                {code === undefined || code === null ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <button
                    type="button"
                    className="rounded-md font-mono text-lg font-semibold tracking-widest text-left hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setSharing({ type, qrOnly: false })}
                    aria-label={t('showJoinQr', { role: label })}
                  >
                    {formatJoinCodeDisplay(code)}
                  </button>
                )}
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('showJoinQr', { role: label })}
                    disabled={!code}
                    onClick={() => setSharing({ type, qrOnly: true })}
                  >
                    <QrCode />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('openJoinQrWindow', { role: label })}
                    disabled={!code}
                    onClick={() => handleOpenShareWindow(type)}
                  >
                    <ExternalLink />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('copyRoleCode', { role: label })}
                    disabled={!code}
                    onClick={() => handleCopy(type)}
                  >
                    <Copy />
                  </Button>
                  {canRegenerate ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t('roleCodeActions', { role: label })}
                          disabled={!code}
                        >
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={regenerating === type}
                          onClick={() => handleRegenerate(type)}
                        >
                          <RefreshCw
                            className={
                              regenerating === type ? 'animate-spin' : undefined
                            }
                          />
                          {t('regenerateCode')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {sharing && sharingCode !== undefined && sharingRole !== null ? (
        <JoinShareDialog
          open
          onOpenChange={(open) => {
            if (!open) setSharing(null)
          }}
          code={sharingCode}
          role={sharingRole}
          qrOnly={sharing.qrOnly}
        />
      ) : null}
    </section>
  )
}

const MEMBER_ROLE_KEYS = {
  creator: 'roleCreator',
  classTeacher: 'roleClassTeacher',
  assistantTeacher: 'roleAssistantShort',
  student: 'roleStudent',
} as const

type ClassMember = {
  userId: Id<'users'>
  name?: string
  email?: string
  role: ClassRole
}

function ClassMembersSection({
  classId,
  members,
}: {
  classId: Id<'classes'>
  members: Array<ClassMember> | undefined
}) {
  const { t } = useTranslation(['classes', 'common'])
  const removeMember = useMutation(api.memberships.removeMember)
  const [removingUserId, setRemovingUserId] = useState<Id<'users'> | null>(null)

  const handleRemove = (userId: Id<'users'>) => {
    setRemovingUserId(userId)
    void removeMember({ classId, userId })
      .then(() => {
        toast.success(t('memberRemoved'))
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : t('memberRemoveFailed'),
        )
      })
      .finally(() => setRemovingUserId(null))
  }

  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight">{t('members')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('membersDescription')}
      </p>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {members === undefined ? (
          <li className="p-4">
            <Skeleton className="h-5 w-48" />
          </li>
        ) : members.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">
            {t('noMembersYet')}
          </li>
        ) : (
          members.map((member) => {
            const label =
              member.name ??
              member.email ??
              t('common:userFallback', {
                id: member.userId.slice(-6),
              })
            const roleKey =
              MEMBER_ROLE_KEYS[member.role as keyof typeof MEMBER_ROLE_KEYS]
            return (
              <li
                key={member.userId}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {roleKey ? t(roleKey) : member.role}
                    {member.email && member.name ? ` · ${member.email}` : null}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={removingUserId === member.userId}
                  onClick={() => handleRemove(member.userId)}
                >
                  <UserMinus data-icon="inline-start" />
                  {t('common:remove')}
                </Button>
              </li>
            )
          })
        )}
      </ul>
    </section>
  )
}

function ClassManageActions({ classDoc }: { classDoc: ClassPublic }) {
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
        toast.error(
          error instanceof Error
            ? error.message
            : archive
              ? t('updateFailed')
              : t('updateFailed'),
        )
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
        toast.error(
          error instanceof Error ? error.message : t('deleteFailed'),
        )
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
            className="ml-auto shrink-0"
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

function ClassPage() {
  const { t } = useTranslation(['classes', 'common'])
  const { classId } = Route.useParams()
  const typedClassId = classId as Id<'classes'>

  const { data: classDoc, isPending } = useQuery({
    ...convexQuery(api.classes.getClass, {
      classId: typedClassId,
    }),
    gcTime: TEN_MINUTES,
  })

  // Client-side gating is UX only — every server function re-checks.
  const canManage = classDoc?.canManage === true
  const canManageMembers = classDoc?.canManageMembers === true

  const { data: adminBundle } = useQuery({
    ...convexQuery(
      api.memberships.getClassAdminBundle,
      canManageMembers ? { classId: typedClassId } : 'skip',
    ),
    gcTime: TEN_MINUTES,
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:p-8">
      <div className="mb-8">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
          <Link to="/">
            <ArrowLeft data-icon="inline-start" />
            {t('backToClasses')}
          </Link>
        </Button>

        {isPending || classDoc === undefined ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-2/3 max-w-md" />
            <Skeleton className="h-5 w-full max-w-lg" />
          </div>
        ) : classDoc === null ? (
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              {t('notFoundTitle')}
            </h1>
            <p className="text-muted-foreground">{t('notFoundDescription')}</p>
            <Button className="mt-4" asChild>
              <Link to="/">{t('common:goHome')}</Link>
            </Button>
          </div>
        ) : (
          <>
            <header className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                    {classDoc.name}
                  </h1>
                  <ClassRoleBadge role={classDoc.myRole} />
                </div>
                {canManage ? <ClassManageActions classDoc={classDoc} /> : null}
              </div>
              {classDoc.description ? (
                <p className="max-w-2xl text-muted-foreground">
                  {classDoc.description}
                </p>
              ) : null}
            </header>

            {canManageMembers ? (
              <JoinCodesSection
                classId={typedClassId}
                codes={adminBundle?.joinCodes}
                canRegenerate={canManage}
              />
            ) : null}

            {canManage ? (
              <ClassMembersSection
                classId={typedClassId}
                members={adminBundle?.members}
              />
            ) : null}

            {canManageMembers ? (
              <ClassStudentsSection
                classId={typedClassId}
                data={adminBundle?.guardianRoster}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
