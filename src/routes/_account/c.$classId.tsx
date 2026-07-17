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

function classLabel(classDoc: ClassPublic | null | undefined) {
  if (classDoc == null) return 'Class'
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
    const label = classLabel(loaderData?.classDoc)
    return {
      meta: [
        {
          name: 'description',
          content: `Manage ${label} for the ClassClarus webapp`,
        },
        {
          title: `${label} | ClassClarus`,
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
  const regenerate = useMutation(api.classes.regenerateJoinCode)
  const [regenerating, setRegenerating] = useState<JoinCodeType | null>(null)
  const [sharing, setSharing] = useState<JoinCodeType | null>(null)

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
    // Hide staff codes until loaded; null means redacted (no class:manage).
    if (codes === undefined) return false
    return codeFor(type) !== null
  })

  const sharingCodeRaw = sharing ? codeFor(sharing) : null
  const sharingCode =
    typeof sharingCodeRaw === 'string' ? sharingCodeRaw : undefined
  const sharingRole = sharing ? JOIN_CODE_ROLE[sharing] : null

  const handleCopy = (type: JoinCodeType) => {
    const code = codeFor(type)
    if (!code) return
    const label = CLASS_ROLE_BADGE_CONFIG[JOIN_CODE_ROLE[type]].label
    void navigator.clipboard
      .writeText(code)
      .then(() => toast.success(`${label} code copied`))
      .catch(() => toast.error('Failed to copy code'))
  }

  const handleRegenerate = (type: JoinCodeType) => {
    setRegenerating(type)
    const label = CLASS_ROLE_BADGE_CONFIG[JOIN_CODE_ROLE[type]].label
    void regenerate({ classId, codeType: type })
      .then(() => {
        toast.success(`${label} code regenerated`)
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : 'Failed to regenerate code',
        )
      })
      .finally(() => setRegenerating(null))
  }

  const handleOpenShareWindow = (type: JoinCodeType) => {
    const code = codeFor(type)
    if (!code || code.length !== JOIN_CODE_LENGTH) return

    // With `noopener` the browser returns null even on success, so we can't
    // use the return value to detect a blocked popup.
    window.open(
      new URL(getJoinShareUrl(code, JOIN_CODE_ROLE[type])).href,
      '_blank',
      'noopener,noreferrer',
    )
  }

  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight">Join codes</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Share a code to let others join this class with the matching role. Tap a
        code to show a QR for the classroom. Regenerate a code if it leaks —
        existing members keep their access until removed.
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
          return (
            <div
              key={type}
              className={cn('rounded-xl border p-4', roleConfig.className)}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <RoleIcon className="size-3.5" />
                {roleConfig.label}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                {code === undefined || code === null ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <button
                    type="button"
                    className="rounded-md font-mono text-lg font-semibold tracking-widest text-left hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setSharing(type)}
                    aria-label={`Show ${roleConfig.label} join QR`}
                  >
                    {formatJoinCodeDisplay(code)}
                  </button>
                )}
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Show ${roleConfig.label} join QR`}
                    disabled={!code}
                    onClick={() => setSharing(type)}
                  >
                    <QrCode />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Open ${roleConfig.label} join QR in a new window`}
                    disabled={!code}
                    onClick={() => handleOpenShareWindow(type)}
                  >
                    <ExternalLink />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Copy ${roleConfig.label} code`}
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
                          size="icon-sm"
                          aria-label={`${roleConfig.label} code actions`}
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
                          Regenerate code
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

      {sharingCode !== undefined && sharingRole !== null ? (
        <JoinShareDialog
          open
          onOpenChange={(open) => {
            if (!open) setSharing(null)
          }}
          code={sharingCode}
          role={sharingRole}
        />
      ) : null}
    </section>
  )
}

const MEMBER_ROLE_LABELS: Record<string, string> = {
  creator: 'Creator',
  classTeacher: 'Co-teacher',
  assistantTeacher: 'Assistant',
  student: 'Student',
}

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
  const removeMember = useMutation(api.memberships.removeMember)
  const [removingUserId, setRemovingUserId] = useState<Id<'users'> | null>(null)

  const handleRemove = (userId: Id<'users'>) => {
    setRemovingUserId(userId)
    void removeMember({ classId, userId })
      .then(() => {
        toast.success('Member removed')
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : 'Failed to remove member',
        )
      })
      .finally(() => setRemovingUserId(null))
  }

  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight">Members</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Remove access for anyone who joined with a leaked code. Regenerating a
        code does not revoke existing members.
      </p>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {members === undefined ? (
          <li className="p-4">
            <Skeleton className="h-5 w-48" />
          </li>
        ) : members.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">No members yet.</li>
        ) : (
          members.map((member) => {
            const label =
              member.name ?? member.email ?? `User ${member.userId.slice(-6)}`
            return (
              <li
                key={member.userId}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {MEMBER_ROLE_LABELS[member.role] ?? member.role}
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
                  Remove
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
        toast.success(archive ? 'Class archived' : 'Class unarchived')
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : archive
              ? 'Failed to archive class'
              : 'Failed to unarchive class',
        )
      })
  }

  const handleDelete = () => {
    const mutationPromise = removeClass({ classId: classDoc._id })
    setConfirmingDelete(false)

    void mutationPromise
      .then(() => {
        toast.success('Class deleted')
        void navigate({ to: '/' })
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : 'Failed to delete class',
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
            aria-label="Class actions"
          >
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleArchiveToggle}>
            {isArchived ? <ArchiveRestore /> : <Archive />}
            {isArchived ? 'Unarchive' : 'Archive'}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmingDelete(true)}
          >
            <Trash2 />
            Delete
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
            <AlertDialogTitle>Delete class?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Delete “${classDoc.name}”? This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function ClassPage() {
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
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-8">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
          <Link to="/">
            <ArrowLeft data-icon="inline-start" />
            Back to classes
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
              Class not found
            </h1>
            <p className="text-muted-foreground">
              This class may have been deleted or you don&apos;t have access.
            </p>
            <Button className="mt-4" asChild>
              <Link to="/">Go home</Link>
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
