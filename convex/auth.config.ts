import type { AuthConfig } from 'convex/server'

const siteUrl = process.env.CONVEX_SITE_URL
const jwks = process.env.JWKS

/**
 * Prefer static JWKS (customJwt + data URI) so self-hosted backends do not
 * need to HTTP-fetch OIDC discovery from CONVEX_SITE_URL (often a LAN IP
 * that fails hairpin NAT from inside Docker). Falls back to OIDC domain
 * discovery when JWKS is not set (e.g. incomplete bootstrap).
 *
 * Encode with TextEncoder + btoa — no Node `Buffer` (undefined in Convex V8).
 */
function jwksDataUri(jwksJson: string): string {
  const bytes = new TextEncoder().encode(jwksJson)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return `data:application/json;base64,${btoa(binary)}`
}

export default {
  providers: [
    jwks && siteUrl
      ? {
          type: 'customJwt',
          applicationID: 'convex',
          issuer: siteUrl,
          jwks: jwksDataUri(jwks),
          algorithm: 'RS256',
        }
      : {
          domain: siteUrl,
          applicationID: 'convex',
        },
  ],
} satisfies AuthConfig
