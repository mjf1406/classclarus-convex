import { useState } from 'react'
import { useMutation } from 'convex/react'
import {
  ChevronDown,
  Copy,
  Download,
  Link2,
  RefreshCw,
  UserMinus,
} from 'lucide-react'
import { toast } from 'sonner'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { formatJoinCodeDisplay, getJoinUrl } from '@/lib/joinCode'

type ListedGuardian = {
  guardianUserId: Id<'users'>
  name?: string
  linkedAt: number
}

type PendingUnlink =
  | {
      kind: 'one'
      orgStudentId: Id<'orgStudents'>
      studentName: string
      guardianUserId: Id<'users'>
      guardianName: string
    }
  | {
      kind: 'all'
      orgStudentId: Id<'orgStudents'>
      studentName: string
      guardianCount: number
    }

function formatGuardianName(guardian: ListedGuardian): string {
  return guardian.name ?? `User ${guardian.guardianUserId.slice(-6)}`
}

function formatGuardianSummary(guardianCount: number): string {
  if (guardianCount === 0) {
    return 'No guardian linked yet'
  }
  return guardianCount === 1 ? '1 guardian' : `${guardianCount} guardians`
}

export function ClassStudentsSection({
  classId,
  data,
}: {
  classId: Id<'classes'>
  data:
    | {
        className: string
        year: number
        organizationId?: string
        students: Array<{
          orgStudentId: Id<'orgStudents'>
          displayName: string
          guardianCode: string
          guardians: Array<ListedGuardian>
        }>
      }
    | undefined
}) {
  const unlinkGuardian = useMutation(api.guardians.unlinkGuardian)
  const unlinkAllGuardiansForStudent = useMutation(
    api.guardians.unlinkAllGuardiansForStudent,
  )
  const regenerateGuardianCode = useMutation(
    api.guardians.regenerateGuardianCode,
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [pendingUnlink, setPendingUnlink] = useState<PendingUnlink | null>(null)
  const [unlinkingStudentId, setUnlinkingStudentId] =
    useState<Id<'orgStudents'> | null>(null)
  const [regeneratingStudentId, setRegeneratingStudentId] =
    useState<Id<'orgStudents'> | null>(null)

  const handleDownload = async () => {
    if (!data) return

    setIsGenerating(true)
    try {
      const { downloadGuardianCodesPdf } =
        await import('@/lib/guardianCodesPdf')
      await downloadGuardianCodesPdf(data)
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to generate guardian codes PDF',
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyCode = (code: string, displayName: string) => {
    void navigator.clipboard
      .writeText(code)
      .then(() => toast.success(`Code for ${displayName} copied`))
      .catch(() => toast.error('Failed to copy code'))
  }

  const handleCopyLink = (code: string, displayName: string) => {
    void navigator.clipboard
      .writeText(getJoinUrl(code))
      .then(() => toast.success(`Join link for ${displayName} copied`))
      .catch(() => toast.error('Failed to copy link'))
  }

  const handleRegenerate = (
    orgStudentId: Id<'orgStudents'>,
    displayName: string,
  ) => {
    setRegeneratingStudentId(orgStudentId)
    void regenerateGuardianCode({ orgStudentId, classId })
      .then((newCode) => {
        toast.success(`Guardian code regenerated for ${displayName}`)
        void navigator.clipboard.writeText(newCode).catch(() => {
          /* clipboard optional */
        })
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to regenerate guardian code',
        )
      })
      .finally(() => setRegeneratingStudentId(null))
  }

  const handleConfirmUnlink = () => {
    if (!pendingUnlink) return

    const unlinking = pendingUnlink
    setPendingUnlink(null)
    setUnlinkingStudentId(unlinking.orgStudentId)

    const mutationPromise =
      unlinking.kind === 'one'
        ? unlinkGuardian({
            classId,
            orgStudentId: unlinking.orgStudentId,
            guardianUserId: unlinking.guardianUserId,
          }).then(() => 1)
        : unlinkAllGuardiansForStudent({
            classId,
            orgStudentId: unlinking.orgStudentId,
          })

    void mutationPromise
      .then((removed) => {
        toast.success(
          unlinking.kind === 'one'
            ? `${unlinking.guardianName} removed as guardian`
            : `${removed} guardian${removed === 1 ? '' : 's'} removed`,
        )
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : unlinking.kind === 'one'
              ? 'Failed to remove guardian'
              : 'Failed to remove guardians',
        )
      })
      .finally(() => setUnlinkingStudentId(null))
  }

  const dialogTitle =
    pendingUnlink?.kind === 'one'
      ? 'Remove guardian?'
      : 'Remove all guardians?'
  const dialogDescription =
    pendingUnlink?.kind === 'one'
      ? `Remove ${pendingUnlink.guardianName} as guardian for ${pendingUnlink.studentName}?`
      : pendingUnlink
        ? `Remove all ${pendingUnlink.guardianCount} guardians from ${pendingUnlink.studentName}?`
        : ''

  return (
    <>
      <section className="mt-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">Students</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each enrolled student has a private guardian join code (max 5
              guardians). Copy a code or link to share, regenerate if it leaks,
              or download print-ready QR slips for the whole class.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="default"
            className="shrink-0"
            aria-label="Download guardian codes PDF"
            disabled={data === undefined || isGenerating}
            onClick={() => void handleDownload()}
          >
            <Download /> Download PDF
          </Button>
        </div>

        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {data === undefined ? (
            <li className="p-4">
              <Skeleton className="h-5 w-48" />
            </li>
          ) : data.students.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">
              No students yet. Students appear here after they join with the
              student code.
            </li>
          ) : (
            data.students.map((student) => {
              const isUnlinking = unlinkingStudentId === student.orgStudentId
              const isRegenerating =
                regeneratingStudentId === student.orgStudentId
              return (
                <li key={student.orgStudentId} className="px-4 py-3">
                  <Collapsible>
                    <div className="flex items-start justify-between gap-3">
                      <CollapsibleTrigger className="group min-w-0 flex-1 rounded-md text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring">
                        <div className="flex items-start gap-2 py-0.5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {student.displayName}
                            </p>
                            <p className="font-mono text-xs tracking-widest text-muted-foreground">
                              {formatJoinCodeDisplay(student.guardianCode)}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatGuardianSummary(student.guardians.length)}
                            </p>
                          </div>
                          <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                        </div>
                      </CollapsibleTrigger>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Copy code for ${student.displayName}`}
                          onClick={() =>
                            handleCopyCode(
                              student.guardianCode,
                              student.displayName,
                            )
                          }
                        >
                          <Copy />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Copy join link for ${student.displayName}`}
                          onClick={() =>
                            handleCopyLink(
                              student.guardianCode,
                              student.displayName,
                            )
                          }
                        >
                          <Link2 />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Regenerate guardian code for ${student.displayName}`}
                          disabled={isRegenerating}
                          onClick={() =>
                            handleRegenerate(
                              student.orgStudentId,
                              student.displayName,
                            )
                          }
                        >
                          <RefreshCw
                            className={
                              isRegenerating ? 'animate-spin' : undefined
                            }
                          />
                        </Button>
                      </div>
                    </div>

                    <CollapsibleContent className="mt-2">
                      {student.guardians.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No guardian linked yet
                        </p>
                      ) : (
                        <div className="space-y-2 text-xs">
                          <p className="font-medium text-muted-foreground">
                            Guardians
                          </p>
                          <ul className="space-y-1">
                            {student.guardians.map((guardian) => {
                              const guardianName = formatGuardianName(guardian)
                              return (
                                <li
                                  key={guardian.guardianUserId}
                                  className="flex max-w-lg items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1"
                                >
                                  <span className="min-w-0 truncate">
                                    {guardianName}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 shrink-0 px-2 text-xs"
                                    disabled={isUnlinking}
                                    onClick={() =>
                                      setPendingUnlink({
                                        kind: 'one',
                                        orgStudentId: student.orgStudentId,
                                        studentName: student.displayName,
                                        guardianUserId: guardian.guardianUserId,
                                        guardianName,
                                      })
                                    }
                                  >
                                    <UserMinus data-icon="inline-start" />
                                    Remove
                                  </Button>
                                </li>
                              )
                            })}
                          </ul>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                            disabled={isUnlinking}
                            onClick={() =>
                              setPendingUnlink({
                                kind: 'all',
                                orgStudentId: student.orgStudentId,
                                studentName: student.displayName,
                                guardianCount: student.guardians.length,
                              })
                            }
                          >
                            <UserMinus data-icon="inline-start" />
                            Remove all guardians
                          </Button>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </li>
              )
            })
          )}
        </ul>
      </section>

      <AlertDialog
        open={pendingUnlink !== null}
        onOpenChange={(open) => {
          if (!open) setPendingUnlink(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault()
                handleConfirmUnlink()
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
