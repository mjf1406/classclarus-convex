import type { AuthConfig } from 'convex/server'
import { buildAuthProviders } from './lib/authProviders'

/**
 * Password self-host mode embeds JWKS as a data URI (customJwt) so JWT
 * validation does not require the backend to HTTP-fetch its own public
 * CONVEX_SITE_URL OpenID discovery endpoint (fails under Docker hairpin NAT).
 *
 * Google / production mode keeps standard OIDC domain discovery.
 */
export default {
  providers: buildAuthProviders({
    passwordEnabled: process.env.AUTH_PASSWORD_ENABLED === 'true',
    siteUrl: process.env.CONVEX_SITE_URL,
    jwks: process.env.JWKS,
  }),
} satisfies AuthConfig
