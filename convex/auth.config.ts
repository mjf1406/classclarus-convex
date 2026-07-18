import type { AuthConfig } from 'convex/server'

const siteUrl = process.env.CONVEX_SITE_URL
const jwks = process.env.JWKS

/**
 * Prefer static JWKS (customJwt + data URI) so self-hosted backends do not
 * need to HTTP-fetch OIDC discovery from CONVEX_SITE_URL (often a LAN IP
 * that fails hairpin NAT from inside Docker). Falls back to OIDC domain
 * discovery when JWKS is not set (e.g. incomplete bootstrap).
 */
export default {
  providers: [
    jwks && siteUrl
      ? {
          type: 'customJwt',
          applicationID: 'convex',
          issuer: siteUrl,
          jwks: `data:application/json,${encodeURIComponent(jwks)}`,
          algorithm: 'RS256',
        }
      : {
          domain: siteUrl,
          applicationID: 'convex',
        },
  ],
} satisfies AuthConfig
