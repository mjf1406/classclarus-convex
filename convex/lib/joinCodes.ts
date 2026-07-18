import type { MutationCtx } from '../_generated/server'

export const JOIN_CODE_LENGTH = 8

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const MAX_GENERATION_ATTEMPTS = 10

function generateJoinCode(length = JOIN_CODE_LENGTH): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)

  let code = ''
  for (let index = 0; index < length; index++) {
    code += CODE_CHARS[bytes[index] % CODE_CHARS.length]
  }
  return code
}

async function isCodeTaken(ctx: MutationCtx, code: string): Promise<boolean> {
  const [
    studentClass,
    teacherClass,
    assistantClass,
    guardianStudent,
    schoolPrincipal,
    schoolTeacher,
    schoolAdmin,
  ] = await Promise.all([
    ctx.db
      .query('classes')
      .withIndex('by_studentCode', (query) => query.eq('studentCode', code))
      .first(),
    ctx.db
      .query('classes')
      .withIndex('by_teacherCode', (query) => query.eq('teacherCode', code))
      .first(),
    ctx.db
      .query('classes')
      .withIndex('by_assistantTeacherCode', (query) =>
        query.eq('assistantTeacherCode', code),
      )
      .first(),
    ctx.db
      .query('orgStudents')
      .withIndex('by_guardianCode', (query) => query.eq('guardianCode', code))
      .first(),
    ctx.db
      .query('schoolJoinCodes')
      .withIndex('by_principalCode', (query) => query.eq('principalCode', code))
      .first(),
    ctx.db
      .query('schoolJoinCodes')
      .withIndex('by_teacherCode', (query) => query.eq('teacherCode', code))
      .first(),
    ctx.db
      .query('schoolJoinCodes')
      .withIndex('by_adminCode', (query) => query.eq('adminCode', code))
      .first(),
  ])

  return (
    studentClass !== null ||
    teacherClass !== null ||
    assistantClass !== null ||
    guardianStudent !== null ||
    schoolPrincipal !== null ||
    schoolTeacher !== null ||
    schoolAdmin !== null
  )
}

/**
 * Generates a code that is unique across class, guardian, and school codes.
 * Keeping one global code namespace makes `/join` unambiguous.
 */
export async function generateUniqueJoinCode(
  ctx: MutationCtx,
  reservedCodes: ReadonlyArray<string> = [],
): Promise<string> {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const code = generateJoinCode()
    if (!reservedCodes.includes(code) && !(await isCodeTaken(ctx, code))) {
      return code
    }
  }

  throw new Error('Failed to generate a unique join code')
}
