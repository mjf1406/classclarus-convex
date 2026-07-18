import { useRouterState } from '@tanstack/react-router'
import { useConvexAuth } from '@convex-dev/auth/react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { TEN_MINUTES } from '@/lib/queryCache'
import { coerceClassLanguage, isAppLanguage } from './locales'
import type { AppLanguage, ClassLanguage } from './locales'

/**
 * Resolves the UI language:
 * - guardians → personal
 * - students on /c/$classId with a concrete class language → that language
 * - everyone else (including students when class language is 'user') → personal
 */
export function useActiveLocale(personalLanguage: AppLanguage): {
  activeLanguage: AppLanguage
  canChooseLanguage: boolean
  classLanguage: ClassLanguage | null
  isStudentInClass: boolean
} {
  const { isAuthenticated } = useConvexAuth()
  const classId = useRouterState({
    select: (state) => {
      const match = state.matches.find((routeMatch) =>
        routeMatch.routeId.startsWith('/_account/c/$classId'),
      )
      const params = match?.params
      const id =
        params && 'classId' in params && typeof params.classId === 'string'
          ? params.classId
          : undefined
      return id ? (id as Id<'classes'>) : undefined
    },
  })

  const classDoc = useQuery({
    ...convexQuery(
      api.classes.getClass,
      isAuthenticated && classId ? { classId } : 'skip',
    ),
    gcTime: TEN_MINUTES,
  }).data

  const isGuardian = classDoc?.myRole === 'guardian'
  const isStudentInClass =
    classId !== undefined && classDoc?.myRole === 'student'
  const classLanguage =
    classDoc?.language !== undefined
      ? coerceClassLanguage(classDoc.language)
      : null

  const forcedClassLanguage =
    classLanguage !== null && isAppLanguage(classLanguage)
      ? classLanguage
      : null

  let activeLanguage = personalLanguage
  if (classId && !isGuardian && isStudentInClass && forcedClassLanguage) {
    activeLanguage = forcedClassLanguage
  }

  const canChooseLanguage = !(isStudentInClass && forcedClassLanguage !== null)

  return {
    activeLanguage,
    canChooseLanguage,
    classLanguage,
    isStudentInClass,
  }
}
