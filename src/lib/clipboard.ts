/**
 * Copy text to the clipboard on both secure contexts (HTTPS / localhost /
 * Convex Cloud) and insecure LAN HTTP self-host, where navigator.clipboard
 * is undefined.
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  const clipboard =
    typeof navigator !== 'undefined' ? navigator.clipboard : undefined
  if (clipboard && typeof clipboard.writeText === 'function') {
    await clipboard.writeText(text)
    return
  }

  await copyViaExecCommand(text)
}

function copyViaExecCommand(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Clipboard is not available in this environment.'))
      return
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '0'
    textarea.style.left = '0'
    textarea.style.width = '1px'
    textarea.style.height = '1px'
    textarea.style.padding = '0'
    textarea.style.border = 'none'
    textarea.style.outline = 'none'
    textarea.style.boxShadow = 'none'
    textarea.style.background = 'transparent'
    textarea.style.opacity = '0'

    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, text.length)

    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    } finally {
      document.body.removeChild(textarea)
    }

    if (ok) {
      resolve()
    } else {
      reject(new Error('Failed to copy text to the clipboard.'))
    }
  })
}
