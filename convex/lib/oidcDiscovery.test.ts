import { describe, expect, it } from 'vite-plus/test'
import {
  buildJwksResponseBody,
  buildOpenIdConfiguration,
} from './oidcDiscovery'

describe('buildOpenIdConfiguration', () => {
  it('builds issuer and jwks_uri from the site URL', () => {
    expect(buildOpenIdConfiguration('http://192.168.0.148:3211')).toEqual({
      issuer: 'http://192.168.0.148:3211',
      jwks_uri: 'http://192.168.0.148:3211/.well-known/jwks.json',
      authorization_endpoint: 'http://192.168.0.148:3211/oauth/authorize',
    })
  })

  it('strips a trailing slash from the site URL', () => {
    expect(buildOpenIdConfiguration('http://127.0.0.1:3211/').issuer).toBe(
      'http://127.0.0.1:3211',
    )
  })
})

describe('buildJwksResponseBody', () => {
  it('accepts a JWKS document with keys', () => {
    const jwks = JSON.stringify({ keys: [{ kty: 'RSA', kid: '1' }] })
    expect(buildJwksResponseBody(jwks)).toBe(jwks)
  })

  it('rejects invalid JWKS', () => {
    expect(() => buildJwksResponseBody('{}')).toThrow(/keys array/)
    expect(() => buildJwksResponseBody('not-json')).toThrow()
  })
})
