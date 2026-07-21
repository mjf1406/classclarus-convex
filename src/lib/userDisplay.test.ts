import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { getDisplayName, getInitials } from './userDisplay'
import { createPendingId } from './pendingId'

describe('getInitials', () => {
  it('uses two name words', () => {
    expect(getInitials({ name: 'Ada Lovelace' })).toBe('AL')
  })

  it('uses first two chars of a single name', () => {
    expect(getInitials({ name: 'Madonna' })).toBe('MA')
  })

  it('uses separators in the email local-part', () => {
    expect(getInitials({ email: 'ada.lovelace@example.com' })).toBe('AL')
  })

  it('never returns the full unsplit local-part', () => {
    expect(getInitials({ email: 'mjfitzgerald@example.com' })).toBe('MJ')
  })

  it('never returns the full email address', () => {
    const initials = getInitials({ email: 'user@example.com' })
    expect(initials).toBe('US')
    expect(initials.length).toBeLessThanOrEqual(2)
    expect(initials).not.toContain('@')
  })
})

describe('getDisplayName', () => {
  it('title-cases a name', () => {
    expect(getDisplayName({ name: 'ada lovelace' })).toBe('Ada Lovelace')
  })

  it('formats email local-part parts', () => {
    expect(getDisplayName({ email: 'ada.lovelace@example.com' })).toBe(
      'Ada Lovelace',
    )
  })
})

describe('createPendingId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => '11111111-2222-4333-8444-555555555555',
    })
    expect(createPendingId()).toBe(
      'PENDING-11111111-2222-4333-8444-555555555555',
    )
  })

  it('falls back when randomUUID is missing (LAN HTTP)', () => {
    const bytes = new Uint8Array(16)
    bytes.fill(7)
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => {
        arr.set(bytes)
        return arr
      },
    })
    const id = createPendingId('PENDING-')
    expect(id.startsWith('PENDING-')).toBe(true)
    expect(id).toMatch(
      /^PENDING-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })
})
