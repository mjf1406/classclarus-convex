import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { copyTextToClipboard } from './clipboard'

describe('copyTextToClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses navigator.clipboard.writeText when available (cloud / HTTPS)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      clipboard: { writeText },
    })

    await copyTextToClipboard('ABC123')
    expect(writeText).toHaveBeenCalledWith('ABC123')
  })

  it('falls back to execCommand when clipboard API is missing (LAN HTTP)', async () => {
    vi.stubGlobal('navigator', {})

    const execCommand = vi.fn().mockReturnValue(true)
    const appendChild = vi.fn()
    const removeChild = vi.fn()
    const focus = vi.fn()
    const select = vi.fn()
    const setSelectionRange = vi.fn()

    const textarea = {
      value: '',
      setAttribute: vi.fn(),
      style: {} as CSSStyleDeclaration,
      focus,
      select,
      setSelectionRange,
    }

    vi.stubGlobal('document', {
      createElement: vi.fn(() => textarea),
      body: { appendChild, removeChild },
      execCommand,
    })

    await copyTextToClipboard('JOIN99')
    expect(textarea.value).toBe('JOIN99')
    expect(appendChild).toHaveBeenCalledWith(textarea)
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(removeChild).toHaveBeenCalledWith(textarea)
  })

  it('rejects when fallback copy fails', async () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        value: '',
        setAttribute: vi.fn(),
        style: {},
        focus: vi.fn(),
        select: vi.fn(),
        setSelectionRange: vi.fn(),
      })),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
      execCommand: vi.fn().mockReturnValue(false),
    })

    await expect(copyTextToClipboard('NOPE')).rejects.toThrow(/Failed to copy/)
  })
})
