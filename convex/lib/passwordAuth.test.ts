import { afterEach, describe, expect, it } from 'vitest'
import {
  assertValidEmail,
  isPasswordAuthEnabled,
  normalizeEmail,
  validatePasswordRequirements,
} from './passwordAuth'

describe('passwordAuth helpers', () => {
  const original = process.env.AUTH_PASSWORD_ENABLED

  afterEach(() => {
    if (original === undefined) {
      delete process.env.AUTH_PASSWORD_ENABLED
    } else {
      process.env.AUTH_PASSWORD_ENABLED = original
    }
  })

  it('normalizes email case and whitespace', () => {
    expect(normalizeEmail('  Ada@School.EDU ')).toBe('ada@school.edu')
  })

  it('asserts valid emails', () => {
    expect(assertValidEmail('Ada@School.EDU')).toBe('ada@school.edu')
    expect(() => assertValidEmail('not-email')).toThrow()
  })

  it('requires passwords of at least 8 characters', () => {
    expect(() => validatePasswordRequirements('short')).toThrow()
    expect(() => validatePasswordRequirements('longenough')).not.toThrow()
  })

  it('reads AUTH_PASSWORD_ENABLED from the environment', () => {
    process.env.AUTH_PASSWORD_ENABLED = 'true'
    expect(isPasswordAuthEnabled()).toBe(true)
    process.env.AUTH_PASSWORD_ENABLED = 'false'
    expect(isPasswordAuthEnabled()).toBe(false)
  })
})
