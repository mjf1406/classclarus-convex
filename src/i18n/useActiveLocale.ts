import { useRouterState } from '@tanstack/react-router'
import { useConvexAuth } from '@convex-dev/auth/react'
import { useQuery } from 'convex/react'

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { coerceAppLanguage } from './locales'
import type { AppLanguage } from './locales'

/**
 * Resolves the UI language:
 * - guardians → personal
 * - students on /c/$classId → class language
 * - everyone else → personal
 */
export function useActiveLocale(personalLanguage: AppLanguage): {
  activeLanguage: AppLanguage
  canChooseLanguage: boolean
  classLanguage: AppLanguage | null
  isStudentInClass: boolean
} {
  const { isAuthenticated } = useConvexAuth()
  const classId = useRouterState({
    select: (state) => {
      const match = state.matches.find(
        (routeMatch) => routeMatch.routeId === '/_account/c/$classId',
      )
      const id = match?.params.classId
      return typeof id === 'string' ? (id as Id<'classes'>) : undefined
    },
  })

  const classDoc = useQuery(
    api.classes.getClass,
    isAuthenticated && classId ? { classId } : 'skip',
  )

  const isGuardian = classDoc?.myRole === 'guardian'
  const isStudentInClass =
    classId !== undefined && classDoc?.myRole === 'student'
  const classLanguage =
    classDoc?.language !== undefined
      ? coerceAppLanguage(classDoc.language)
      : null

  let activeLanguage = personalLanguage
  if (classId && !isGuardian && isStudentInClass && classLanguage) {
    activeLanguage = classLanguage
  }

  const canChooseLanguage = !isStudentInClass

  return {
    activeLanguage,
    canChooseLanguage,
    classLanguage,
    isStudentInClass,
  }
}
