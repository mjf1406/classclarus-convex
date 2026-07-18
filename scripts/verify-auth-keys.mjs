/**
 * Verify JWT_PRIVATE_KEY + JWKS can sign and verify a short-lived JWT.
 *
 * Usage:
 *   bun run scripts/verify-auth-keys.mjs <jwt_private_key_file> <jwks_file> [issuer]
 *
 * Exit 0 on success; non-zero with a clear message on failure.
 */
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
  createLocalJWKSet,
  importPKCS8,
  jwtVerify,
  SignJWT,
} from "jose"

const keyPath = process.argv[2]
const jwksPath = process.argv[3]
const issuer = process.argv[4] ?? "http://127.0.0.1:3211"

if (!keyPath || !jwksPath) {
  console.error(
    "Usage: bun run scripts/verify-auth-keys.mjs <jwt_private_key> <jwks> [issuer]",
  )
  process.exit(1)
}

function normalizePem(raw) {
  let value = raw.replace(/^\uFEFF/, "").replace(/\r/g, "").trim()
  // Official Convex Auth format: PKCS8 with newlines collapsed to spaces
  if (value.includes("-----BEGIN") && value.includes("\n")) {
    value = value.replace(/\n/g, " ")
  }
  return value
}

const pem = normalizePem(await readFile(resolve(keyPath), "utf8"))
const jwksRaw = (await readFile(resolve(jwksPath), "utf8"))
  .replace(/^\uFEFF/, "")
  .replace(/\r/g, "")
  .trim()

let jwks
try {
  jwks = JSON.parse(jwksRaw)
} catch {
  console.error("ERROR: JWKS file is not valid JSON")
  process.exit(1)
}

if (!Array.isArray(jwks.keys) || jwks.keys.length === 0) {
  console.error("ERROR: JWKS has no keys[]")
  process.exit(1)
}

const kid = jwks.keys[0]?.kid
if (typeof kid !== "string" || kid.length === 0) {
  console.error("ERROR: JWKS first key is missing kid")
  process.exit(1)
}

if (!pem.includes("BEGIN PRIVATE KEY") && !pem.includes("BEGIN RSA PRIVATE KEY")) {
  console.error(
    `ERROR: JWT_PRIVATE_KEY does not look like PKCS8 PEM (length=${pem.length})`,
  )
  process.exit(1)
}

let privateKey
try {
  privateKey = await importPKCS8(pem, "RS256")
} catch (err) {
  console.error(
    `ERROR: importPKCS8 failed: ${err instanceof Error ? err.message : String(err)}`,
  )
  console.error(`    key length=${pem.length}`)
  process.exit(1)
}

let token
try {
  token = await new SignJWT({ sub: "verify-auth-keys" })
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience("convex")
    .setExpirationTime("2m")
    .sign(privateKey)
} catch (err) {
  console.error(
    `ERROR: SignJWT failed: ${err instanceof Error ? err.message : String(err)}`,
  )
  process.exit(1)
}

try {
  const jwksSet = createLocalJWKSet(jwks)
  await jwtVerify(token, jwksSet, {
    issuer,
    audience: "convex",
  })
} catch (err) {
  console.error(
    `ERROR: JWT verify against JWKS failed (key/JWKS mismatch?): ${
      err instanceof Error ? err.message : String(err)
    }`,
  )
  process.exit(1)
}

console.error(
  `==> verify-auth-keys ok (keyLength=${pem.length}, kid=${kid}, issuer=${issuer})`,
)
process.exit(0)
