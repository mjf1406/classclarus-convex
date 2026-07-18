/**
 * Ensure a JWKS JSON file has an RFC 7638 thumbprint `kid` on each key.
 *
 * Usage:
 *   bun run scripts/ensure-jwks-kid.mjs /path/to/jwks
 *
 * Prints the first key's kid to stdout (for deploy.sh → JWT_KID).
 * Rewrites the file in place when any key is missing `kid`.
 * Public key material is unchanged — existing bootstrap keys keep working.
 */
import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { calculateJwkThumbprint } from "jose"

const fileArg = process.argv[2]
if (!fileArg) {
  console.error("Usage: bun run scripts/ensure-jwks-kid.mjs <jwks-file>")
  process.exit(1)
}

const filePath = resolve(fileArg)
const raw = await readFile(filePath, "utf8")
/** @type {{ keys?: Array<Record<string, unknown>> }} */
let parsed
try {
  parsed = JSON.parse(raw)
} catch {
  console.error(`ERROR: ${filePath} is not valid JSON`)
  process.exit(1)
}

if (!parsed || !Array.isArray(parsed.keys) || parsed.keys.length === 0) {
  console.error(`ERROR: ${filePath} is not a JWKS object with keys[]`)
  process.exit(1)
}

let changed = false
for (const key of parsed.keys) {
  if (typeof key.kid === "string" && key.kid.length > 0) continue
  key.kid = await calculateJwkThumbprint(key)
  changed = true
}

if (changed) {
  await writeFile(filePath, JSON.stringify(parsed), "utf8")
  console.error(`==> Added kid to JWKS at ${filePath}`)
}

const firstKid = parsed.keys[0]?.kid
if (typeof firstKid !== "string" || firstKid.length === 0) {
  console.error("ERROR: Could not determine JWT kid from JWKS")
  process.exit(1)
}

process.stdout.write(firstKid)
