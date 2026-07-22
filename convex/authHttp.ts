import type { HttpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { isPasswordAuthEnabled } from './lib/passwordAuth'
import {
  buildJwksResponseBody,
  buildOpenIdConfiguration,
} from './lib/oidcDiscovery'

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control':
    'public, max-age=15, stale-while-revalidate=15, stale-if-error=86400',
}

/**
 * Explicit OIDC discovery + JWKS routes for password-only self-host mode.
 * Convex Auth's `addHttpRoutes` is skipped in this mode so we do not depend on
 * its deployed route set for JWT validation.
 */
export function registerPasswordAuthHttpRoutes(http: HttpRouter): void {
  if (!isPasswordAuthEnabled()) {
    throw new Error(
      'registerPasswordAuthHttpRoutes requires AUTH_PASSWORD_ENABLED=true',
    )
  }

  http.route({
    path: '/.well-known/openid-configuration',
    method: 'GET',
    handler: httpAction(() => {
      const body = buildOpenIdConfiguration(requireSiteUrl())
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: JSON_HEADERS,
        }),
      )
    }),
  })

  http.route({
    path: '/.well-known/jwks.json',
    method: 'GET',
    handler: httpAction(() => {
      return Promise.resolve(
        new Response(buildJwksResponseBody(requireJwks()), {
          status: 200,
          headers: JSON_HEADERS,
        }),
      )
    }),
  })
}

function requireSiteUrl(): string {
  const value = process.env.CONVEX_SITE_URL
  if (!value) {
    throw new Error('Missing environment variable `CONVEX_SITE_URL`')
  }
  return value
}

function requireJwks(): string {
  const value = process.env.JWKS
  if (!value) {
    throw new Error('Missing environment variable `JWKS`')
  }
  return value
}
