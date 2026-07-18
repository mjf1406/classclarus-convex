import type { AuthConfig } from 'convex/server'

const siteUrl = process.env.CONVEX_SITE_URL
const jwks = process.env.JWKS

/**
 * Prefer static JWKS (customJwt + data URI) so self-hosted backends do not
 * need to HTTP-fetch OIDC discovery from CONVEX_SITE_URL (often a LAN IP
 * that fails hairpin NAT from inside Docker). Falls back to OIDC domain
 * discovery when JWKS is not set (e.g. incomplete bootstrap).
 *
 * Use base64 data URIs (Convex-documented form) so the backend JWKS parser
 * accepts the embedded key set.
 */
function jwksDataUri(jwksJson: string): string {
  const base64 = Buffer.from(jwksJson, 'utf8').toString('base64')
  return `data:application/json;base64,${base64}`
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
