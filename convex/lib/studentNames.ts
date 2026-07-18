import { v } from 'convex/values'
import type { Doc } from '../_generated/dataModel'

export const genderValidator = v.union(
  v.literal('male'),
  v.literal('female'),
  v.literal('nonBinary'),
  v.literal('transgender'),
  v.literal('agender'),
  v.literal('genderfluid'),
  v.literal('unspecified'),
)

export const pronounsValidator = v.union(
  v.literal('sheHer'),
  v.literal('heHim'),
  v.literal('theyThem'),
  v.literal('itIts'),
  v.literal('perPers'),
  v.literal('zeHir'),
  v.literal('xeXem'),
  v.literal('nameOnly'),
  v.literal('unspecified'),
)

export type StudentGender =
  | 'male'
  | 'female'
  | 'nonBinary'
  | 'transgender'
  | 'agender'
  | 'genderfluid'
  | 'unspecified'

export type StudentPronouns =
  | 'sheHer'
  | 'heHim'
  | 'theyThem'
  | 'itIts'
  | 'perPers'
  | 'zeHir'
  | 'xeXem'
  | 'nameOnly'
  | 'unspecified'

/** Split a freeform name into first/last. Single token → lastName only. */
export function splitDisplayName(displayName: string): {
  firstName: string
  lastName: string
} {
  const trimmed = displayName.trim()
  if (!trimmed) {
    return { firstName: '', lastName: 'Student' }
  }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return { firstName: '', lastName: parts[0] }
  }
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  }
}

export function namesFromUser(user: Doc<'users'>): {
  firstName: string
  lastName: string
  email?: string
} {
  const source = user.name?.trim() || user.email?.trim() || 'Student'
  const { firstName, lastName } = splitDisplayName(source)
  return {
    firstName,
    lastName,
    email: user.email?.trim() || undefined,
  }
}

export function legalFirstName(orgStudent: Doc<'orgStudents'>): string {
  if (orgStudent.firstName !== undefined) return orgStudent.firstName
  if (orgStudent.displayName !== undefined) {
    return splitDisplayName(orgStudent.displayName).firstName
  }
  return ''
}

export function legalLastName(orgStudent: Doc<'orgStudents'>): string {
  if (orgStudent.lastName !== undefined) return orgStudent.lastName
  if (orgStudent.displayName !== undefined) {
    return splitDisplayName(orgStudent.displayName).lastName
  }
  return 'Student'
}

export function formatPersonName(firstName: string, lastName: string): string {
  const formatted = [firstName.trim(), lastName.trim()]
    .filter(Boolean)
    .join(' ')
  return formatted || 'Student'
}

/** Class display: roster overrides, else legal names (with legacy displayName fallback). */
export function formatClassStudentName(
  enrollment: Pick<
    Doc<'classEnrollments'>,
    'rosterFirstName' | 'rosterLastName'
  >,
  orgStudent: Doc<'orgStudents'>,
): string {
  const rosterFirst = enrollment.rosterFirstName?.trim()
  const rosterLast = enrollment.rosterLastName?.trim()
  const firstName = rosterFirst || legalFirstName(orgStudent)
  const lastName = rosterLast || legalLastName(orgStudent)
  return formatPersonName(firstName, lastName)
}

export function formatOrgStudentName(orgStudent: Doc<'orgStudents'>): string {
  return formatPersonName(legalFirstName(orgStudent), legalLastName(orgStudent))
}
