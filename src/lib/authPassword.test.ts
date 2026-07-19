import { describe, expect, it } from 'vitest'
import {
  passwordSignInSchema,
  passwordSignUpSchema,
} from './authPassword'

describe('passwordSignInSchema', () => {
  it('accepts a valid email and password', () => {
    const result = passwordSignInSchema.safeParse({
      email: 'teacher@school.edu',
      password: 'secret123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = passwordSignInSchema.safeParse({
      email: 'not-an-email',
      password: 'secret123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects short passwords', () => {
    const result = passwordSignInSchema.safeParse({
      email: 'teacher@school.edu',
      password: 'short',
    })
    expect(result.success).toBe(false)
  })
})

describe('passwordSignUpSchema', () => {
  it('requires matching passwords', () => {
    const mismatch = passwordSignUpSchema.safeParse({
      email: 'teacher@school.edu',
      password: 'secret123',
      confirmPassword: 'secret999',
    })
    expect(mismatch.success).toBe(false)
    if (!mismatch.success) {
      expect(mismatch.error.issues.some((i) => i.message === 'mismatch')).toBe(
        true,
      )
    }

    const match = passwordSignUpSchema.safeParse({
      email: 'teacher@school.edu',
      password: 'secret123',
      confirmPassword: 'secret123',
      name: 'Ada',
    })
    expect(match.success).toBe(true)
  })
})
