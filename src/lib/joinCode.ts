export const JOIN_CODE_LENGTH = 8

const EN_DASH = '\u2013'

/**
 * Strip whitespace and dashes (hyphen or en dash), then uppercase.
 * Used for API submission and when accepting pasted formatted codes.
 */
export function normalizeJoinCode(input: string): string {
  return input.replace(/[\s\u2013-]/g, '').toUpperCase()
}

/**
 * Display an 8-character join code as `ABCD–EFGH`.
 * Partial codes get the en dash once the first half is complete.
 */
export function formatJoinCodeDisplay(code: string): string {
  const normalized = normalizeJoinCode(code)
  if (normalized.length <= 4) {
    return normalized
  }
  return `${normalized.slice(0, 4)}${EN_DASH}${normalized.slice(4)}`
}

export function getJoinPagePath(): string {
  return '/join'
}

/** Absolute join page URL (no code), e.g. `https://localhost:3000/join`. */
export function getJoinPageUrl(): string {
  const path = getJoinPagePath()
  if (typeof window === 'undefined') {
    return path
  }
  return `${window.location.origin}${path}`
}

/** Absolute join URL with optional prefilled code for QR / share links. */
export function getJoinUrl(code: string): string {
  const normalized = normalizeJoinCode(code).slice(0, JOIN_CODE_LENGTH)
  if (typeof window === 'undefined') {
    return `${getJoinPagePath()}?joinCode=${encodeURIComponent(normalized)}`
  }
  const url = new URL(getJoinPagePath(), window.location.origin)
  url.searchParams.set('joinCode', normalized)
  return url.href
}

export function getJoinShareUrl(code: string, role: string): string {
  const normalized = normalizeJoinCode(code).slice(0, JOIN_CODE_LENGTH)
  if (typeof window === 'undefined') {
    return `/join-share?joinCode=${encodeURIComponent(normalized)}&role=${encodeURIComponent(role)}`
  }
  const url = new URL('/join-share', window.location.origin)
  url.searchParams.set('joinCode', normalized)
  url.searchParams.set('role', role)
  return url.href
}
