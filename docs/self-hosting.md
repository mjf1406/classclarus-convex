# Self-host ClassClarus

This guide gets ClassClarus running on your machine (or a VPS) with **one Docker Compose command**. You do not need a Convex Cloud account.

Deploying through **Portainer** instead? Use [self-hosting-portainer.md](self-hosting-portainer.md).

When it finishes you will have:

| What | URL (local defaults) |
|------|----------------------|
| **App (website)** | http://localhost:3000 |
| **Convex dashboard** | http://localhost:6791 |
| Convex API | http://127.0.0.1:3210 |
| Convex HTTP actions (OAuth callbacks) | http://127.0.0.1:3211 |

---

## What you need

Install these before you start:

1. **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (Windows/macOS) or Docker Engine + Compose (Linux)
2. Enough free disk (~2 GB for images on first pull)
3. Free ports on your machine: **3000**, **3210**, **3211**, **6791**

Optional later:

- A Google Cloud project (only if you want **Sign in with Google**)
- [Bun](https://bun.sh) (only if you want helper scripts outside Docker)

Check Docker works:

```bash
docker --version
docker compose version
```

---

## Deploy with Portainer

If you manage Docker with Portainer, follow the dedicated guide instead of the CLI steps below:

**[Self-host with Portainer](self-hosting-portainer.md)** — Git stack, env vars in the UI, admin key from the `bootstrap` volume.

---

## Quick start (local)

### 1. Get the project

```bash
git clone <your-repo-url> classclarus-convex
cd classclarus-convex
```

### 2. Create your config file

```bash
cp .env.example .env
```

### 3. Set a secret (required)

Open `.env` in a text editor and set `INSTANCE_SECRET` to a new random value.

**Generate one:**

```bash
# macOS / Linux / Git Bash / WSL
openssl rand -hex 32
```

```powershell
# Windows PowerShell
-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
# Or if OpenSSL is available:
openssl rand -hex 32
```

Paste the result into `.env`:

```env
INSTANCE_NAME=convex-self-hosted
INSTANCE_SECRET=paste_your_64_character_hex_here
```

Leave the other defaults as-is for local use. You can add Google login later.

> Treat `INSTANCE_SECRET` like a password. Anyone with it can administer your Convex instance. Do not commit `.env` to git.

### 4. Start everything

```bash
docker compose up -d --build
```

First run downloads Convex images and builds the site — often **5–15 minutes**. Later starts are much faster.

Watch progress:

```bash
docker compose logs -f deploy
```

When deploy finishes successfully you should see a line like `Deploy complete`. Then open the app.

### 5. Open the app

1. Website: **http://localhost:3000**
2. Dashboard: **http://localhost:6791**

**Dashboard login**

The admin key is stored in the Docker volume **`bootstrap`** (often named `<project>_bootstrap`, e.g. `classclarus-convex_bootstrap`).

```bash
# Confirm the volume name
docker volume ls | grep bootstrap

# Print the key (adjust the volume name if needed)
docker run --rm -v classclarus-convex_bootstrap:/output alpine cat /output/admin_key
```

Paste that key into the dashboard login screen.

---

## Verify it worked

```bash
# All services should look healthy / running (deploy & admin-key will show Exited 0)
docker compose ps

# Backend responds
curl http://127.0.0.1:3210/version
```

In the browser:

- http://localhost:3000 loads the ClassClarus UI
- http://localhost:6791 accepts your admin key and shows data / logs

If something failed, jump to [Troubleshooting](#troubleshooting).

---

## Day-to-day commands

```bash
# Start (after first successful build)
docker compose up -d

# Stop (keeps your data)
docker compose stop

# Stop and remove containers (keeps the data volume)
docker compose down

# Rebuild after code or URL changes
docker compose up -d --build

# Follow logs
docker compose logs -f
docker compose logs -f backend
docker compose logs -f deploy
docker compose logs -f web
```

**Redeploy only Convex functions** (after you change files under `convex/`):

```bash
docker compose up -d --build deploy
```

**Rebuild only the website** (required if you change `VITE_CONVEX_URL` or other public URLs):

```bash
docker compose up -d --build web
```

---

## Enable Sign in with Google (optional)

Local defaults work without Google, but login needs OAuth credentials.

### 1. Create OAuth credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an **OAuth client ID** (application type: **Web application**)
3. Under **Authorized JavaScript origins**, add:

   ```text
   http://localhost:3000
   ```

4. Under **Authorized redirect URIs**, add:

   ```text
   http://127.0.0.1:3211/api/auth/callback/google
   ```

5. Copy the **Client ID** and **Client secret**

### 2. Put them in `.env`

```env
AUTH_GOOGLE_ID=your-client-id.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=your-client-secret
```

### 3. Apply and redeploy

```bash
docker compose up -d --build deploy
```

Then try Google sign-in on http://localhost:3000.

If you later put the app on a real domain, update Google origins/redirects to match your new `SITE_URL` and `CONVEX_SITE_ORIGIN` (see [Public server / domain](#public-server--domain)).

---

## What Docker created for you

After a successful first boot, the **`bootstrap`** volume contains:

| File | Purpose |
|------|---------|
| `admin_key` | Paste into the Convex dashboard |
| `jwt_private_key` | Convex Auth signing key (auto-created if you left JWT vars blank) |
| `jwks` | Matching public JWKS |

Keep this volume. Removing it can break auth until you redeploy with new keys.

Your **app data** (classes, users, etc.) lives in the Docker volume **`data`** (e.g. `classclarus-convex_data`).

---

## Public server / domain

Compose publishes plain HTTP ports. For a VPS with a domain, put a reverse proxy (Caddy, Traefik, nginx, Cloudflare) in front, then point hostnames at:

| Hostname example | Proxies to |
|------------------|------------|
| `app.example.com` | host port `3000` (web) |
| `api.example.com` | host port `3210` (Convex API) |
| `actions.example.com` | host port `3211` (HTTP actions / OAuth) |
| `dash.example.com` (optional) | host port `6791` (dashboard) |

Update `.env` so the **browser** can reach Convex (not Docker-internal names like `http://backend:3210`):

```env
SITE_URL=https://app.example.com
CONVEX_CLOUD_ORIGIN=https://api.example.com
CONVEX_SITE_ORIGIN=https://actions.example.com
NEXT_PUBLIC_DEPLOYMENT_URL=https://api.example.com
VITE_CONVEX_URL=https://api.example.com
```

Then rebuild web + redeploy:

```bash
docker compose up -d --build
```

Update Google OAuth:

- Origin: `https://app.example.com`
- Redirect: `https://actions.example.com/api/auth/callback/google`

---

## Back up your data

Stop the backend briefly, then archive the Docker volume (name may vary; check with `docker volume ls`):

```bash
docker compose stop backend

docker run --rm \
  -v classclarus-convex_data:/data \
  -v "$(pwd):/backup" \
  alpine tar czf /backup/convex-data-backup.tgz -C /data .

docker run --rm \
  -v classclarus-convex_bootstrap:/output \
  -v "$(pwd):/backup" \
  alpine tar czf /backup/convex-bootstrap-backup.tgz -C /output .

docker compose start backend
```

Also copy `.env` (especially `INSTANCE_SECRET`).

Store backups somewhere safe. Losing `INSTANCE_SECRET` or the data volume means you cannot recover that instance cleanly.

---

## Troubleshooting

### `INSTANCE_SECRET` error when starting

You must have a `.env` file with `INSTANCE_SECRET` set (64 hex characters).

```bash
cp .env.example .env
openssl rand -hex 32   # paste into INSTANCE_SECRET=
```

### Port already in use

Change ports in `.env`, for example:

```env
WEB_PORT=3001
PORT=3212
SITE_PROXY_PORT=3213
DASHBOARD_PORT=6792
```

If you change `PORT` / `SITE_PROXY_PORT`, also update:

```env
CONVEX_CLOUD_ORIGIN=http://127.0.0.1:3212
CONVEX_SITE_ORIGIN=http://127.0.0.1:3213
NEXT_PUBLIC_DEPLOYMENT_URL=http://127.0.0.1:3212
VITE_CONVEX_URL=http://127.0.0.1:3212
```

Then `docker compose up -d --build`.

### Website loads but cannot talk to Convex

`VITE_CONVEX_URL` must be a URL **your browser** can open (usually `http://127.0.0.1:3210` locally). Never use `http://backend:3210` for the website build.

Rebuild the site after fixing it:

```bash
docker compose up -d --build web
```

### Deploy container failed

```bash
docker compose logs deploy
docker compose up -d --build deploy
```

Common causes: backend not healthy yet, missing `INSTANCE_SECRET`, or network/DNS blocking image pulls.

### Dashboard will not accept a key

```bash
docker run --rm -v classclarus-convex_bootstrap:/output alpine cat /output/admin_key
```

Use the **entire** string (no extra spaces). If you changed `INSTANCE_SECRET` after the first boot, regenerate:

```bash
docker compose up -d --build admin-key deploy
docker run --rm -v classclarus-convex_bootstrap:/output alpine cat /output/admin_key
```

### Google sign-in fails

1. Confirm `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` are in `.env`
2. Confirm redirect URI is exactly  
   `http://127.0.0.1:3211/api/auth/callback/google` (local)  
   or your production `CONVEX_SITE_ORIGIN` + `/api/auth/callback/google`
3. Redeploy: `docker compose up -d --build deploy`

### Reset everything (destructive)

This deletes containers **and** the database / bootstrap volumes:

```bash
docker compose down -v
# Keep or recreate .env as needed
docker compose up -d --build
```

---

## Architecture (short)

```text
Browser
  ├─ :3000  → web (nginx + static SPA)
  ├─ :3210  → Convex backend (queries / mutations / WebSocket)
  ├─ :3211  → Convex HTTP actions (OAuth callbacks)
  └─ :6791  → Convex dashboard

SQLite data  → Docker volume "data"
Secrets/keys → .env + Docker volume "bootstrap"
```

On `docker compose up`, Compose starts the backend, generates an admin key, sets auth environment variables, deploys your `convex/` functions, then serves the site.

---

## Related files

| File | Role |
|------|------|
| [`.env.example`](../.env.example) | Template for `.env` |
| [`docker-compose.yml`](../docker-compose.yml) | Full stack definition |
| [`Dockerfile`](../Dockerfile) | Builds and serves the website |
| [`docker/deploy.sh`](../docker/deploy.sh) | One-shot Convex deploy + auth bootstrap |
| [`scripts/generate-auth-keys.mjs`](../scripts/generate-auth-keys.mjs) | Optional local JWT key generator |
| [self-hosting-portainer.md](self-hosting-portainer.md) | Portainer Git stack guide |
