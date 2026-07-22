import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { generateUniqueJoinCode, JOIN_CODE_LENGTH } from './joinCodes'
import {
  GUARDIAN_RELATION,
  guardianAuthz,
  guardianObject,
  guardianSubject,
} from './guardianAuth'

/** Hard cap: distinct guardians linked to one orgStudent. */
export const MAX_STUDENT_GUARDIANS = 5

const UNLINK_BATCH = 10

export function linkMatchesOrg(
  link: Doc<'guardianLinks'>,
  organizationId: string | undefined,
): boolean {
  return link.organizationId === organizationId
}

export async function listGuardianLinksForStudent(
  ctx: QueryCtx | MutationCtx,
  orgStudentId: Id<'orgStudents'>,
  organizationId: string | undefined,
): Promise<Array<Doc<'guardianLinks'>>> {
  const links = await ctx.db
    .query('guardianLinks')
    .withIndex('by_orgStudentId', (index) =>
      index.eq('orgStudentId', orgStudentId),
    )
    .take(MAX_STUDENT_GUARDIANS + 1)
  return links.filter((link) => linkMatchesOrg(link, organizationId))
}

export async function countGuardiansForStudent(
  ctx: QueryCtx | MutationCtx,
  orgStudentId: Id<'orgStudents'>,
  organizationId: string | undefined,
): Promise<number> {
  const links = await listGuardianLinksForStudent(
    ctx,
    orgStudentId,
    organizationId,
  )
  return links.length
}

export async function unlinkGuardianLinkInternal(
  ctx: MutationCtx,
  callerId: Id<'users'>,
  orgStudent: Doc<'orgStudents'>,
  guardianUserId: Id<'users'>,
): Promise<void> {
  const tenantAuthz = guardianAuthz(orgStudent.organizationId)
  await tenantAuthz.removeRelation(
    ctx,
    guardianSubject(guardianUserId),
    GUARDIAN_RELATION,
    guardianObject(orgStudent._id),
    callerId,
  )

  const link = await ctx.db
    .query('guardianLinks')
    .withIndex('by_guardianUserId_and_orgStudentId', (index) =>
      index
        .eq('guardianUserId', guardianUserId)
        .eq('orgStudentId', orgStudent._id),
    )
    .unique()
  if (link) {
    await ctx.db.delete('guardianLinks', link._id)
  }
}

/**
 * Removes every guardian link for the student (paginated until empty).
 */
export async function unlinkAllGuardiansForOrgStudent(
  ctx: MutationCtx,
  callerId: Id<'users'>,
  orgStudent: Doc<'orgStudents'>,
): Promise<number> {
  let removed = 0
  for (;;) {
    const batch = await ctx.db
      .query('guardianLinks')
      .withIndex('by_orgStudentId', (index) =>
        index.eq('orgStudentId', orgStudent._id),
      )
      .take(UNLINK_BATCH)
    if (batch.length === 0) break

    for (const link of batch) {
      await unlinkGuardianLinkInternal(
        ctx,
        callerId,
        orgStudent,
        link.guardianUserId,
      )
      removed += 1
    }
  }
  return removed
}

export async function rotateGuardianCode(
  ctx: MutationCtx,
  orgStudentId: Id<'orgStudents'>,
): Promise<string> {
  const guardianCode = await generateUniqueJoinCode(ctx)
  await ctx.db.patch('orgStudents', orgStudentId, { guardianCode })
  return guardianCode
}

/**
 * On student leave: revoke guardian access and invalidate the printed code.
 */
export async function revokeGuardiansAndRotateCode(
  ctx: MutationCtx,
  callerId: Id<'users'>,
  orgStudent: Doc<'orgStudents'>,
): Promise<void> {
  await unlinkAllGuardiansForOrgStudent(ctx, callerId, orgStudent)
  await rotateGuardianCode(ctx, orgStudent._id)
}

const INVALID_CODE_ERROR = 'Invalid join code'
const GUARDIAN_CAP_ERROR =
  'This student already has the maximum number of guardians'

/**
 * Redeem a guardian code without rate limiting (caller applies limits once).
 */
export async function tryRedeemGuardianCode(
  ctx: MutationCtx,
  userId: Id<'users'>,
  rawCode: string,
): Promise<
  { ok: true; orgStudentId: Id<'orgStudents'> } | { ok: false; error: string }
> {
  const code = rawCode.replace(/[\s\u2013-]/g, '').toUpperCase()
  if (code.length !== JOIN_CODE_LENGTH) {
    return { ok: false, error: INVALID_CODE_ERROR }
  }

  const orgStudent = await ctx.db
    .query('orgStudents')
    .withIndex('by_guardianCode', (index) => index.eq('guardianCode', code))
    .unique()
  if (!orgStudent) {
    return { ok: false, error: INVALID_CODE_ERROR }
  }

  const existingLink = await ctx.db
    .query('guardianLinks')
    .withIndex('by_guardianUserId_and_orgStudentId', (index) =>
      index.eq('guardianUserId', userId).eq('orgStudentId', orgStudent._id),
    )
    .unique()

  const tenantAuthz = guardianAuthz(orgStudent.organizationId)
  const subject = guardianSubject(userId)
  const object = guardianObject(orgStudent._id)
  const relationExists = await tenantAuthz.hasRelation(
    ctx,
    subject,
    GUARDIAN_RELATION,
    object,
  )

  // Idempotent: already linked → ensure relation + return success.
  if (existingLink && linkMatchesOrg(existingLink, orgStudent.organizationId)) {
    if (!relationExists) {
      await tenantAuthz.addRelation(ctx, subject, GUARDIAN_RELATION, object, {
        createdBy: userId,
      })
    }
    return { ok: true, orgStudentId: orgStudent._id }
  }

  const guardianCount = await countGuardiansForStudent(
    ctx,
    orgStudent._id,
    orgStudent.organizationId,
  )
  if (guardianCount >= MAX_STUDENT_GUARDIANS) {
    return { ok: false, error: GUARDIAN_CAP_ERROR }
  }

  if (!relationExists) {
    await tenantAuthz.addRelation(ctx, subject, GUARDIAN_RELATION, object, {
      createdBy: userId,
    })
  }

  if (!existingLink) {
    await ctx.db.insert('guardianLinks', {
      organizationId: orgStudent.organizationId,
      guardianUserId: userId,
      orgStudentId: orgStudent._id,
      linkedByUserId: userId,
      linkedAt: Date.now(),
    })
  }

  return { ok: true, orgStudentId: orgStudent._id }
}
