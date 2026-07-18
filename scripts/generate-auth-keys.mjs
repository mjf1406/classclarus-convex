/**
 * Generate Convex Auth JWT_PRIVATE_KEY + JWKS (RS256).
 *
 * Usage:
 *   bun run scripts/generate-auth-keys.mjs
 *   bun run scripts/generate-auth-keys.mjs --write-dir .convex-self-hosted
 *
 * Paste the printed values into .env, or let docker/deploy.sh generate them.
 */
import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { exportJWK, exportPKCS8, generateKeyPair } from "jose"

const writeDirArg = process.argv.indexOf("--write-dir")
const writeDir =
  writeDirArg !== -1 ? process.argv[writeDirArg + 1] : undefined

const keys = await generateKeyPair("RS256", { extractable: true })
const privateKey = await exportPKCS8(keys.privateKey)
const publicKey = await exportJWK(keys.publicKey)
const jwtPrivateKey = privateKey.trimEnd().replace(/\n/g, " ")
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] })

if (writeDir) {
  const dir = resolve(writeDir)
  await mkdir(dir, { recursive: true })
  await writeFile(resolve(dir, "jwt_private_key"), jwtPrivateKey, "utf8")
  await writeFile(resolve(dir, "jwks"), jwks, "utf8")
  console.error(`Wrote JWT keys to ${dir}/jwt_private_key and ${dir}/jwks`)
}

process.stdout.write(`JWT_PRIVATE_KEY="${jwtPrivateKey}"\n`)
process.stdout.write(`JWKS=${jwks}\n`)
