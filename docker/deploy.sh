#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${CONVEX_SELF_HOSTED_URL:-http://backend:3210}"
SITE_URL="${SITE_URL:-http://localhost:3000}"
# Public HTTP-actions origin (JWT issuer). Compose sets this from CONVEX_SITE_ORIGIN.
CONVEX_SITE_URL_VALUE="${CONVEX_SITE_URL:-http://127.0.0.1:3211}"
OUTPUT_DIR="${OUTPUT_DIR:-/output}"
CREDENTIALS_DIR="${CREDENTIALS_DIR:-/credentials}"

mkdir -p "$OUTPUT_DIR"

echo "==> Waiting for Convex backend at ${BACKEND_URL}..."
for i in $(seq 1 60); do
  if curl -sf "${BACKEND_URL}/version" >/dev/null; then
    echo "==> Backend is healthy"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "ERROR: Backend did not become healthy in time" >&2
    exit 1
  fi
  sleep 2
done

if [ ! -f "${CREDENTIALS_DIR}/admin_key" ]; then
  echo "ERROR: Missing admin key at ${CREDENTIALS_DIR}/admin_key" >&2
  exit 1
fi

ADMIN_KEY="$(tr -d '\r\n' < "${CREDENTIALS_DIR}/admin_key")"
printf '%s\n' "$ADMIN_KEY" > "${OUTPUT_DIR}/admin_key"
echo "==> Admin key written to ${OUTPUT_DIR}/admin_key (use this in the dashboard)"

export CONVEX_SELF_HOSTED_URL="$BACKEND_URL"
export CONVEX_SELF_HOSTED_ADMIN_KEY="$ADMIN_KEY"
# Avoid mixing cloud deploy credentials
unset CONVEX_DEPLOY_KEY CONVEX_DEPLOYMENT 2>/dev/null || true

# Resolve JWT keys: env → persisted files → generate once
JWT_PRIVATE_KEY_VALUE="${JWT_PRIVATE_KEY:-}"
JWKS_VALUE="${JWKS:-}"

if [ -z "$JWT_PRIVATE_KEY_VALUE" ] || [ -z "$JWKS_VALUE" ]; then
  if [ -f "${OUTPUT_DIR}/jwt_private_key" ] && [ -f "${OUTPUT_DIR}/jwks" ]; then
    echo "==> Reusing JWT keys from ${OUTPUT_DIR}"
    JWT_PRIVATE_KEY_VALUE="$(cat "${OUTPUT_DIR}/jwt_private_key")"
    JWKS_VALUE="$(cat "${OUTPUT_DIR}/jwks")"
  else
    echo "==> Generating Convex Auth JWT keys..."
    bun /app/scripts/generate-auth-keys.mjs --write-dir "$OUTPUT_DIR"
    JWT_PRIVATE_KEY_VALUE="$(cat "${OUTPUT_DIR}/jwt_private_key")"
    JWKS_VALUE="$(cat "${OUTPUT_DIR}/jwks")"
    echo "==> JWT keys saved under ${OUTPUT_DIR} (persist this folder / copy into .env for production)"
  fi
else
  printf '%s' "$JWT_PRIVATE_KEY_VALUE" > "${OUTPUT_DIR}/jwt_private_key"
  printf '%s' "$JWKS_VALUE" > "${OUTPUT_DIR}/jwks"
fi

# Normalize PEM: strip BOM/CRLF; collapse PEM newlines to spaces (Convex Auth format)
normalize_jwt_private_key() {
  local raw="$1"
  raw="${raw#$'\xEF\xBB\xBF'}"
  raw="$(printf '%s' "$raw" | tr -d '\r')"
  raw="$(printf '%s' "$raw" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  if [[ "$raw" == *$'\n'* ]]; then
    raw="$(printf '%s' "$raw" | tr '\n' ' ' | sed -e 's/  */ /g' -e 's/[[:space:]]*$//')"
  fi
  printf '%s' "$raw"
}

JWT_PRIVATE_KEY_VALUE="$(normalize_jwt_private_key "$JWT_PRIVATE_KEY_VALUE")"
JWKS_VALUE="$(printf '%s' "$JWKS_VALUE" | tr -d '\r' | sed 's/^\xEF\xBB\xBF//' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

set_env_value() {
  local name="$1"
  local value="$2"
  if [ -z "$value" ]; then
    return 0
  fi
  echo "==> Setting Convex env: ${name}"
  # stdin avoids shell-quoting issues with PEM / JSON values
  printf '%s' "$value" | bunx convex env set "$name"
}

set_env_file() {
  local name="$1"
  local file="$2"
  echo "==> Setting Convex env: ${name} (from file)"
  bunx convex env set "$name" --from-file "$file"
}

set_env_value SITE_URL "$SITE_URL"
# Explicit issuer for generateToken + auth.config (must match CONVEX_SITE_ORIGIN).
# On some backends this is a system var injected from CONVEX_SITE_ORIGIN — ignore set failures.
echo "==> Setting Convex env: CONVEX_SITE_URL"
if ! printf '%s' "$CONVEX_SITE_URL_VALUE" | bunx convex env set CONVEX_SITE_URL; then
  echo "==> WARN: could not set CONVEX_SITE_URL via CLI (often system-injected from CONVEX_SITE_ORIGIN)"
  echo "    Expected runtime value: ${CONVEX_SITE_URL_VALUE}"
fi
echo "==> CONVEX_SITE_URL=${CONVEX_SITE_URL_VALUE}"

printf '%s' "$JWT_PRIVATE_KEY_VALUE" > "${OUTPUT_DIR}/jwt_private_key"
printf '%s' "$JWKS_VALUE" > "${OUTPUT_DIR}/jwks"

# Self-hosted customJwt requires kid in both JWKS and JWT header (JWT_KID).
# Migrates existing bootstrap keys that were generated without a kid.
JWT_KID_VALUE="$(bun /app/scripts/ensure-jwks-kid.mjs "${OUTPUT_DIR}/jwks")"
printf '%s' "$JWT_KID_VALUE" > "${OUTPUT_DIR}/jwt_kid"
JWKS_VALUE="$(cat "${OUTPUT_DIR}/jwks")"
echo "==> JWT kid: ${JWT_KID_VALUE}"
echo "==> JWT_PRIVATE_KEY length: ${#JWT_PRIVATE_KEY_VALUE}"

# Fail fast if keys cannot sign/verify (before pushing functions)
echo "==> Verifying JWT key pair (sign + JWKS verify)..."
if ! bun /app/scripts/verify-auth-keys.mjs \
  "${OUTPUT_DIR}/jwt_private_key" \
  "${OUTPUT_DIR}/jwks" \
  "$CONVEX_SITE_URL_VALUE"; then
  echo "ERROR: JWT key verification failed. Refuse to deploy broken auth." >&2
  exit 1
fi

set_env_file JWT_PRIVATE_KEY "${OUTPUT_DIR}/jwt_private_key"
set_env_file JWKS "${OUTPUT_DIR}/jwks"
set_env_value JWT_KID "$JWT_KID_VALUE"

# Self-host always enables email/password (cloud must not set this)
set_env_value AUTH_PASSWORD_ENABLED true

if [ -n "${AUTH_GOOGLE_ID:-}" ] && [ -n "${AUTH_GOOGLE_SECRET:-}" ]; then
  set_env_value AUTH_GOOGLE_ID "$AUTH_GOOGLE_ID"
  set_env_value AUTH_GOOGLE_SECRET "$AUTH_GOOGLE_SECRET"
else
  echo "==> Skipping Google OAuth env (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET not set)"
fi

echo "==> Deploying Convex functions to ${BACKEND_URL}..."
cd /app
if ! bunx convex deploy --yes; then
  echo "ERROR: convex deploy failed." >&2
  echo "    Check convex/auth.config.ts (JWKS / CONVEX_SITE_URL) and deploy logs above." >&2
  echo "    On the host, re-run with visible logs: docker compose up --build deploy" >&2
  exit 1
fi

echo "==> Running auth diagnostics (runtime JWT signing)..."
set +e
DIAG_OUT="$(bunx convex run internal.authDiagnostics.checkJwtSigning 2>&1)"
DIAG_STATUS=$?
set -e
echo "$DIAG_OUT"
if [ "$DIAG_STATUS" -ne 0 ] || ! printf '%s' "$DIAG_OUT" | grep -q '"signOk"[[:space:]]*:[[:space:]]*true'; then
  echo "ERROR: auth diagnostics: JWT signing failed at runtime (or diagnostics did not run)." >&2
  echo "    Dashboard → Logs → filter auth:signIn for the same root cause." >&2
  exit 1
fi
echo "==> auth diagnostics: ok"

echo "==> Deploy complete"
echo "    App:       ${SITE_URL}"
echo "    Site URL:  ${CONVEX_SITE_URL_VALUE}"
echo "    Dashboard: http://localhost:6791"
echo "    Admin key: ${OUTPUT_DIR}/admin_key"
echo "    JWT kid:   ${JWT_KID_VALUE}"
