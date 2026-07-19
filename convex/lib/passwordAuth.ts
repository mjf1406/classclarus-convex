import { ConvexError } from 'convex/values'

/** True when self-hosted password auth is enabled on this deployment. */
export function isPasswordAuthEnabled(): boolean {
  return process.env.AUTH_PASSWORD_ENABLED === 'true'
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function assertValidEmail(email: string): string {
  const normalized = normalizeEmail(email)
  if (!EMAIL_RE.test(normalized)) {
    throw new ConvexError('Invalid email address.')
  }
  return normalized
}

/** Default Convex Auth rule: non-empty and at least 8 characters. */
export function validatePasswordRequirements(password: string): void {
  if (typeof password !== 'string' || password.length < 8) {
    throw new ConvexError('Password must be at least 8 characters.')
  }
}
