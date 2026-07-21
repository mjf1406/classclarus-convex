// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

describe('locale bootstrap', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
          values.set(key, value)
        },
        removeItem: (key: string) => {
          values.delete(key)
        },
        clear: () => {
          values.clear()
        },
      },
    })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: globalThis,
    })
    document.documentElement.lang = 'en'
    Object.defineProperty(navigator, 'language', {
      configurable: true,
      value: 'ko',
    })
    Object.defineProperty(navigator, 'languages', {
      configurable: true,
      value: ['ko'],
    })
    vi.resetModules()
  })

  it('persists the detected locale and sets html lang before React mounts', async () => {
    await import('./index')

    expect(localStorage.getItem('classclarus-language')).toBe('ko')
    expect(document.documentElement.lang).toBe('ko')
  })

  it('ensurePersonalLanguagePersisted writes when the key is missing', async () => {
    const { ensurePersonalLanguagePersisted } = await import('./locales')

    expect(localStorage.getItem('classclarus-language')).toBeNull()
    expect(ensurePersonalLanguagePersisted('ja')).toBe('ja')
    expect(localStorage.getItem('classclarus-language')).toBe('ja')
  })
})
