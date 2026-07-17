import type { ClassPublic } from '#/lib/classes'

export function classLabel(
  classDoc: ClassPublic | null | undefined,
  fallback: string,
) {
  if (classDoc == null) return fallback
  return `(${classDoc.year}) ${classDoc.name}`
}
