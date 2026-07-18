import { createContext, useContext } from 'react'

import type { ClassPublic } from '#/lib/classes'
import type { Id } from '../../../convex/_generated/dataModel'
import type { ClassMember } from '#/components/classes/ClassMembersSection'

export type GuardianRosterData = {
  className: string
  year: number
  organizationId?: string
  students: Array<{
    orgStudentId: Id<'orgStudents'>
    displayName: string
    guardianCode: string
    guardians: Array<{
      guardianUserId: Id<'users'>
      name?: string
      email?: string
      linkedAt: number
    }>
  }>
}

export type ClassAdminBundle = {
  joinCodes: {
    studentCode: string
    teacherCode: string | null
    assistantTeacherCode: string | null
  }
  members: Array<ClassMember>
  guardianRoster: GuardianRosterData
}

type ClassLayoutContextValue = {
  classId: Id<'classes'>
  classDoc: ClassPublic | null | undefined
  adminBundle: ClassAdminBundle | undefined
  canManage: boolean
  canManageMembers: boolean
  isPending: boolean
}

const ClassLayoutContext = createContext<ClassLayoutContextValue | null>(null)

export function ClassLayoutProvider({
  value,
  children,
}: {
  value: ClassLayoutContextValue
  children: React.ReactNode
}) {
  return (
    <ClassLayoutContext.Provider value={value}>
      {children}
    </ClassLayoutContext.Provider>
  )
}

export function useClassLayout() {
  const context = useContext(ClassLayoutContext)
  if (!context) {
    throw new Error('useClassLayout must be used within ClassLayoutProvider')
  }
  return context
}
