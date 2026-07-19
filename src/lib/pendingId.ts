/**
 * Optimistic pending IDs. Prefer crypto.randomUUID when available (HTTPS /
 * localhost). On plain HTTP LAN hosts it is missing — fall back safely.
 */
export function createPendingId(prefix = 'PENDING-'): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : fallbackUuid()
  return `${prefix}${uuid}`
}

function fallbackUuid(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    // RFC 4122 version 4 variant bits
    bytes[6] = ((bytes.at(6) ?? 0) & 0x0f) | 0x40
    bytes[8] = ((bytes.at(8) ?? 0) & 0x3f) | 0x80
    return formatUuidBytes(bytes)
  }

  let hex = ''
  for (let i = 0; i < 32; i++) {
    hex += Math.floor(Math.random() * 16).toString(16)
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function formatUuidBytes(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}
