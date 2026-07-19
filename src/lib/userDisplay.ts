export type UserDisplayInput = {
  name?: string
  email?: string
}

/** Two-character avatar initials; never the full email or local-part. */
export function getInitials(user: UserDisplayInput): string {
  if (user.name && user.name.trim()) {
    const parts = user.name.trim().split(/\s+/).filter(Boolean)
    const first = parts[0]
    const second = parts[1]
    if (first && second) {
      return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase()
    }
    if (first) {
      return first.slice(0, 2).toUpperCase()
    }
  }

  const localStr = (user.email?.split('@')[0] ?? user.email ?? '').trim()
  if (!localStr) return '?'

  const parts = localStr.split(/[._-]/).filter(Boolean)
  const first = parts[0]
  const second = parts[1]
  if (first && second) {
    return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase()
  }
  return localStr.slice(0, 2).toUpperCase()
}

export function getDisplayName(user: UserDisplayInput): string {
  if (user.name && user.name.trim()) {
    return user.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ')
  }

  const localStr = (user.email?.split('@')[0] ?? user.email ?? '').trim()
  if (!localStr) return ''

  return localStr
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
