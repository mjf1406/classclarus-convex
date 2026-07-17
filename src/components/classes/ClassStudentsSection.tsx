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
import { useTranslation } from 'react-i18next'
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
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
  const { t } = useTranslation(['classes', 'common'])
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

  const formatGuardianName = (guardian: ListedGuardian): string =>
    guardian.name ??
    t('common:userFallback', {
      id: guardian.guardianUserId.slice(-6),
    })

  const formatGuardianSummary = (guardianCount: number): string => {
    if (guardianCount === 0) return t('noGuardianLinked')
    return t('guardianCount', { count: guardianCount })
  }

  const handleDownload = async () => {
    if (!data) return

    setIsGenerating(true)
    try {
      const { downloadGuardianCodesPdf } =
        await import('@/lib/guardianCodesPdf')
      await downloadGuardianCodesPdf(data)
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : t('downloadGuardianCodePdfFailed'),
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyCode = (code: string, displayName: string) => {
    void navigator.clipboard
      .writeText(code)
      .then(() => toast.success(t('codeForCopied', { name: displayName })))
      .catch(() => toast.error(t('codeCopyFailed')))
  }

  const handleCopyLink = (code: string, displayName: string) => {
    void navigator.clipboard
      .writeText(getJoinUrl(code))
      .then(() => toast.success(t('linkForCopied', { name: displayName })))
      .catch(() => toast.error(t('linkCopyFailed')))
  }

  const handleRegenerate = (
    orgStudentId: Id<'orgStudents'>,
    displayName: string,
  ) => {
    setRegeneratingStudentId(orgStudentId)
    void regenerateGuardianCode({ orgStudentId, classId })
      .then((newCode) => {
        toast.success(t('guardianCodeRegenerated', { name: displayName }))
        void navigator.clipboard.writeText(newCode).catch(() => {
          /* clipboard optional */
        })
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : t('guardianCodeRegenerateFailed'),
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
            ? t('guardianRemoved', { name: unlinking.guardianName })
            : t('guardiansRemoved', { count: removed }),
        )
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : unlinking.kind === 'one'
              ? t('removeGuardianFailed')
              : t('removeGuardiansFailed'),
        )
      })
      .finally(() => setUnlinkingStudentId(null))
  }

  const dialogTitle =
    pendingUnlink?.kind === 'one'
      ? t('removeGuardianTitle')
      : t('removeAllGuardiansTitle')
  const dialogDescription =
    pendingUnlink?.kind === 'one'
      ? t('removeGuardianDescription', {
          guardian: pendingUnlink.guardianName,
          student: pendingUnlink.studentName,
        })
      : pendingUnlink
        ? t('removeAllGuardiansDescription', {
            count: pendingUnlink.guardianCount,
            student: pendingUnlink.studentName,
          })
        : ''

  return (
    <>
      <section className="">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">
              {t('students')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('studentsDescription')}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="default"
            className="w-full shrink-0 sm:w-auto"
            aria-label={t('downloadGuardianCodePdfAria')}
            disabled={data === undefined || isGenerating}
            onClick={() => void handleDownload()}
          >
            <Download /> {t('downloadGuardianCodePdf')}
          </Button>
        </div>

        {data === undefined ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Card key={i} size="sm">
                <CardHeader>
                  <div className="min-w-0">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="mt-2 h-4 w-24" />
                    <Skeleton className="mt-1.5 h-4 w-20" />
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : data.students.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
            {t('noStudentsYet')}
          </div>
        ) : (
          <ul className="mt-4 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.students.map((student) => {
              const isUnlinking = unlinkingStudentId === student.orgStudentId
              const isRegenerating =
                regeneratingStudentId === student.orgStudentId
              return (
                <li key={student.orgStudentId} className="min-w-0">
                  <Card size="sm">
                    <Collapsible className="contents">
                      <CardHeader className="min-w-0">
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <CollapsibleTrigger className="group min-w-0 flex-1 rounded-md text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring">
                            <div className="flex items-start gap-2 py-0.5">
                              <div className="min-w-0 flex-1">
                                <p
                                  className="truncate text-sm font-medium"
                                  title={student.displayName}
                                >
                                  {student.displayName}
                                </p>
                                <p className="font-mono text-xs tracking-widest text-muted-foreground">
                                  {formatJoinCodeDisplay(student.guardianCode)}
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {formatGuardianSummary(
                                    student.guardians.length,
                                  )}
                                </p>
                              </div>
                              <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                            </div>
                          </CollapsibleTrigger>
                          <div className="flex shrink-0 gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t('copyCodeFor', {
                                name: student.displayName,
                              })}
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
                              aria-label={t('copyLinkFor', {
                                name: student.displayName,
                              })}
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
                              aria-label={t('regenerateGuardianFor', {
                                name: student.displayName,
                              })}
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
                      </CardHeader>

                      <CollapsibleContent>
                        <CardContent>
                          {student.guardians.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              {t('noGuardianLinked')}
                            </p>
                          ) : (
                            <div className="space-y-2 text-xs">
                              <p className="font-medium text-muted-foreground">
                                {t('guardians')}
                              </p>
                              <ul className="space-y-1">
                                {student.guardians.map((guardian) => {
                                  const guardianName =
                                    formatGuardianName(guardian)
                                  return (
                                    <li
                                      key={guardian.guardianUserId}
                                      className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1"
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
                                            guardianUserId:
                                              guardian.guardianUserId,
                                            guardianName,
                                          })
                                        }
                                      >
                                        <UserMinus data-icon="inline-start" />
                                        {t('common:remove')}
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
                                {t('removeAllGuardians')}
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
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
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault()
                handleConfirmUnlink()
              }}
            >
              {t('common:remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
