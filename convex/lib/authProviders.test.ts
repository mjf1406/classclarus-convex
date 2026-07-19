import { describe, expect, it } from 'vitest'
import {
  buildAuthProviders,
  buildPasswordCustomJwtProvider,
  jwksToDataUri,
  utf8ToBase64,
} from './authProviders'

const SITE = 'http://192.168.0.148:3211'
const JWKS = JSON.stringify({
  keys: [{ kty: 'RSA', kid: 'test', n: 'abc', e: 'AQAB' }],
})

describe('buildAuthProviders', () => {
  it('uses customJwt with static JWKS data URI in password mode', () => {
    const providers = buildAuthProviders({
      passwordEnabled: true,
      siteUrl: SITE,
      jwks: JWKS,
    })

    expect(providers).toEqual([
      {
        type: 'customJwt',
        applicationID: 'convex',
        issuer: SITE,
        algorithm: 'RS256',
        jwks: jwksToDataUri(JWKS),
      },
    ])
    const jwksField = providers[0] && 'jwks' in providers[0] ? providers[0].jwks : ''
    expect(jwksField).toMatch(/^data:text\/plain;charset=utf-8;base64,/)
  })

  it('preserves exact issuer (no trailing-slash mutation)', () => {
    const withSlash = `${SITE}/`
    const provider = buildPasswordCustomJwtProvider(withSlash, JWKS)
    expect(provider).toMatchObject({
      type: 'customJwt',
      issuer: withSlash,
      applicationID: 'convex',
    })
  })

  it('uses OIDC domain provider when password mode is off', () => {
    expect(
      buildAuthProviders({
        passwordEnabled: false,
        siteUrl: SITE,
        jwks: undefined,
      }),
    ).toEqual([
      {
        domain: SITE,
        applicationID: 'convex',
      },
    ])
  })

  it('requires CONVEX_SITE_URL in both modes', () => {
    expect(() =>
      buildAuthProviders({
        passwordEnabled: false,
        siteUrl: undefined,
        jwks: JWKS,
      }),
    ).toThrow(/CONVEX_SITE_URL/)
  })

  it('requires JWKS in password mode', () => {
    expect(() =>
      buildAuthProviders({
        passwordEnabled: true,
        siteUrl: SITE,
        jwks: undefined,
      }),
    ).toThrow(/JWKS/)
  })

  it('rejects invalid JWKS in password mode', () => {
    expect(() =>
      buildAuthProviders({
        passwordEnabled: true,
        siteUrl: SITE,
        jwks: '{}',
      }),
    ).toThrow(/keys array/)
  })
})

describe('jwksToDataUri / utf8ToBase64', () => {
  it('round-trips ASCII JSON via base64', () => {
    const encoded = utf8ToBase64(JWKS)
    expect(atob(encoded)).toBe(JWKS)
    const uri = jwksToDataUri(JWKS)
    const payload = uri.replace('data:text/plain;charset=utf-8;base64,', '')
    expect(atob(payload)).toBe(JWKS)
  })
})
