import { v } from 'convex/values'
import { importPKCS8, SignJWT } from 'jose'
import { internalMutation } from './_generated/server'

/**
 * Deploy-time / ops check: env presence + whether JWT signing works
 * with the same inputs Convex Auth uses at runtime.
 *
 * Does not return secrets — only booleans and a short error string.
 */
export const checkJwtSigning = internalMutation({
  args: {},
  returns: v.object({
    hasJwtPrivateKey: v.boolean(),
    hasJwks: v.boolean(),
    hasJwtKid: v.boolean(),
    hasConvexSiteUrl: v.boolean(),
    jwtPrivateKeyLength: v.number(),
    jwtKid: v.union(v.string(), v.null()),
    convexSiteUrl: v.union(v.string(), v.null()),
    signOk: v.boolean(),
    error: v.union(v.string(), v.null()),
  }),
  handler: async () => {
    const jwtPrivateKey = process.env.JWT_PRIVATE_KEY
    const jwks = process.env.JWKS
    const jwtKid = process.env.JWT_KID
    const convexSiteUrl = process.env.CONVEX_SITE_URL

    const hasJwtPrivateKey = Boolean(jwtPrivateKey)
    const hasJwks = Boolean(jwks)
    const hasJwtKid = Boolean(jwtKid)
    const hasConvexSiteUrl = Boolean(convexSiteUrl)

    const base = {
      hasJwtPrivateKey,
      hasJwks,
      hasJwtKid,
      hasConvexSiteUrl,
      jwtPrivateKeyLength: jwtPrivateKey?.length ?? 0,
      jwtKid: jwtKid ?? null,
      convexSiteUrl: convexSiteUrl ?? null,
    }

    if (!jwtPrivateKey) {
      return {
        ...base,
        signOk: false,
        error: 'Missing environment variable `JWT_PRIVATE_KEY`',
      }
    }
    if (!convexSiteUrl) {
      return {
        ...base,
        signOk: false,
        error: 'Missing environment variable `CONVEX_SITE_URL`',
      }
    }

    try {
      const privateKey = await importPKCS8(jwtPrivateKey, 'RS256')
      const header = jwtKid
        ? { alg: 'RS256' as const, kid: jwtKid }
        : { alg: 'RS256' as const }
      await new SignJWT({ sub: 'auth-diagnostics' })
        .setProtectedHeader(header)
        .setIssuedAt()
        .setIssuer(convexSiteUrl)
        .setAudience('convex')
        .setExpirationTime('1m')
        .sign(privateKey)

      return { ...base, signOk: true, error: null }
    } catch (err) {
      return {
        ...base,
        signOk: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  },
})
