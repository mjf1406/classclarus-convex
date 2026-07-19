/** Pure builders for password-mode OIDC discovery responses (testable). */

export function buildOpenIdConfiguration(siteUrl: string): {
  issuer: string
  jwks_uri: string
  authorization_endpoint: string
} {
  const issuer = siteUrl.replace(/\/$/, '')
  return {
    issuer,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    authorization_endpoint: `${issuer}/oauth/authorize`,
  }
}

export function buildJwksResponseBody(jwksJson: string): string {
  const parsed: unknown = JSON.parse(jwksJson)
  if (typeof parsed !== 'object' || parsed === null || !('keys' in parsed)) {
    throw new Error('JWKS must be a JSON object with a keys array')
  }
  if (!Array.isArray(parsed.keys)) {
    throw new Error('JWKS must be a JSON object with a keys array')
  }
  return jwksJson
}
