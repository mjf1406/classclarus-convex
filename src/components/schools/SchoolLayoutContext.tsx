import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

import type { SchoolPublic } from '#/lib/schools'

export type SchoolLayoutValue = {
  schoolId: string
  school: SchoolPublic | null | undefined
  canManage: boolean
  canManageMembers: boolean
  isPending: boolean
}

const SchoolLayoutContext = createContext<SchoolLayoutValue | undefined>(
  undefined,
)

export function SchoolLayoutProvider({
  value,
  children,
}: {
  value: SchoolLayoutValue
  children: ReactNode
}) {
  return (
    <SchoolLayoutContext.Provider value={value}>
      {children}
    </SchoolLayoutContext.Provider>
  )
}

export function useSchoolLayout() {
  const context = useContext(SchoolLayoutContext)
  if (context === undefined) {
    throw new Error('useSchoolLayout must be used within SchoolLayoutProvider')
  }
  return context
}
