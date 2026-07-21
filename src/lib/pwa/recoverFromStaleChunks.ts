// Last-resort safety net for the "Failed to load module script" MIME error.
//
// With every versioned chunk precached, the active service worker serves a
// complete build until the user accepts an update, so this should not fire in
// normal operation. It only triggers if a dynamic import still fails (for
// example a corrupted or externally evicted browser cache). In that case we
// drop this app's service-worker registration and caches once, then reload from
// the network to obtain the currently deployed build.

const RECOVERY_FLAG = 'cc-stale-chunk-recovered'

async function purgeAppCaches(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(
        registrations.map((registration) => registration.unregister()),
      )
    }
    if ('caches' in globalThis) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
  } catch {
    // Best-effort cleanup; still attempt the reload below.
  }
}

function recoverOnce(): void {
  let alreadyRecovered = false
  try {
    alreadyRecovered = sessionStorage.getItem(RECOVERY_FLAG) === '1'
    sessionStorage.setItem(RECOVERY_FLAG, '1')
  } catch {
    // Without sessionStorage we cannot guard against a reload loop, so do
    // nothing rather than risk reloading endlessly.
    return
  }

  if (alreadyRecovered) return

  void purgeAppCaches().finally(() => {
    window.location.reload()
  })
}

// Clear the guard shortly after a successful load so a genuine future failure
// can recover again.
window.addEventListener(
  'load',
  () => {
    window.setTimeout(() => {
      try {
        sessionStorage.removeItem(RECOVERY_FLAG)
      } catch {
        // Ignore unavailable sessionStorage.
      }
    }, 5000)
  },
  { once: true },
)

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  recoverOnce()
})
