import type { AuthProvider } from 'convex/server'
import { buildJwksResponseBody } from './oidcDiscovery'

const AUTH_APPLICATION_ID = 'convex'
const JWT_ALGORITHM = 'RS256' as const

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export type AuthProviderBuildInput = {
  passwordEnabled: boolean
  siteUrl: string | undefined
  jwks: string | undefined
}

/**
 * Build Convex auth providers.
 *
 * Password mode uses `customJwt` with the JWKS embedded as a data URI so the
 * backend validates tokens without fetching its own public LAN OpenID URL
 * (Docker hairpin NAT often times out on that request).
 *
 * Google / OIDC mode keeps the standard domain-based discovery provider.
 */
export function buildAuthProviders(
  input: AuthProviderBuildInput,
): AuthProvider[] {
  const siteUrl = requireNonEmpty(input.siteUrl, 'CONVEX_SITE_URL')

  if (input.passwordEnabled) {
    const jwksJson = requireNonEmpty(input.jwks, 'JWKS')
    return [buildPasswordCustomJwtProvider(siteUrl, jwksJson)]
  }

  return [
    {
      domain: siteUrl,
      applicationID: AUTH_APPLICATION_ID,
    },
  ]
}

export function buildPasswordCustomJwtProvider(
  siteUrl: string,
  jwksJson: string,
): AuthProvider {
  return {
    type: 'customJwt',
    applicationID: AUTH_APPLICATION_ID,
    issuer: siteUrl,
    jwks: jwksToDataUri(jwksJson),
    algorithm: JWT_ALGORITHM,
  }
}

/** Embed JWKS as a data URI so Convex never HTTP-fetches keys during validation. */
export function jwksToDataUri(jwksJson: string): string {
  const validated = buildJwksResponseBody(jwksJson)
  return `data:text/plain;charset=utf-8;base64,${utf8ToBase64(validated)}`
}

function requireNonEmpty(
  value: string | undefined,
  name: string,
): string {
  if (!value) {
    throw new Error(`Missing environment variable \`${name}\``)
  }
  return value
}

/** Pure UTF-8 → Base64 (no Node Buffer / btoa dependency). */
export function utf8ToBase64(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let result = ''
  const len = bytes.length
  for (let i = 0; i < len; i += 3) {
    const a = bytes[i] ?? 0
    const b = i + 1 < len ? (bytes[i + 1] ?? 0) : 0
    const c = i + 2 < len ? (bytes[i + 2] ?? 0) : 0
    const triplet = (a << 16) | (b << 8) | c
    result += BASE64_CHARS[(triplet >> 18) & 63] ?? ''
    result += BASE64_CHARS[(triplet >> 12) & 63] ?? ''
    result += i + 1 < len ? (BASE64_CHARS[(triplet >> 6) & 63] ?? '') : '='
    result += i + 2 < len ? (BASE64_CHARS[triplet & 63] ?? '') : '='
  }
  return result
}
