# Self-host ClassClarus with Portainer

Deploy ClassClarus through **[Portainer](https://docs.portainer.io/)** (CE or EE) using a Git-backed stack. You do not need a Convex Cloud account.

For architecture, domains/reverse proxies, and CLI-only Docker Compose, see [self-hosting.md](self-hosting.md).

When the stack is up:

| What | URL (same-host defaults) |
|------|--------------------------|
| **App** | `http://<host>:3000` |
| **Dashboard** | `http://<host>:6791` |
| Convex API | `http://<host>:3210` |
| HTTP actions (OAuth) | `http://<host>:3211` |

Replace `<host>` with `localhost` or your server’s IP/hostname.

---

## What you need

1. A Docker host already managed by Portainer ([install Portainer](https://docs.portainer.io/start/install-ce) if you do not have it)
2. Free host ports: **3000**, **3210**, **3211**, **6791**
3. This repository available over Git (public URL, or private with credentials Portainer can use)

> **Important:** This stack **builds** Docker images (`web` and `deploy`). You must create the stack from a **Git repository** (or another method that provides a build context). Pasting only `docker-compose.yml` in the web editor without the rest of the repo will fail at build time.

---

## 1. Create a stack from Git

1. In Portainer, open your environment (local or remote).
2. Go to **Stacks** → **Add stack**.
3. Name it, for example: `classclarus`.
4. Choose **Repository** (Git).
5. Fill in:
   - **Repository URL** — `https://github.com/mjf1406/classclarus-convex.git` (or your fork’s HTTPS clone URL)
   - **Compose path** — `docker-compose.yml`
   - **Repository reference** — `refs/heads/main` (Portainer expects `refs/heads/<branch>` or `refs/tags/<tag>`, not a bare branch name like `main`)
6. If the repo is private, add Git credentials (Portainer → account/token as required by your Portainer version). For the public upstream URL above, leave credentials empty.
7. Enable options to **build images** if Portainer shows them for this stack (required for `web` and `deploy`).

Prefer **HTTPS** clone URLs. Use SSH (`git@github.com:...`) only if Portainer already has a deploy key for that host. Do not paste a GitHub web URL that includes `/tree/...`.

You can leave **Repository reference** empty to use the repo’s default `HEAD` (usually `main`). If you set it, use the full ref form above — bare `main` often fails with `reference not found`.

Do not deploy yet — add environment variables first.

---

## 2. Set environment variables

In the stack’s **Environment variables** section, add at least:

| Variable | Example / notes |
|----------|-----------------|
| `INSTANCE_NAME` | `convex-self-hosted` |
| `INSTANCE_SECRET` | **Required.** Generate with `openssl rand -hex 32` (64 hex chars). Treat like a password. |
| `SITE_URL` | `http://localhost:3000` or `http://YOUR_SERVER_IP:3000` |
| `CONVEX_CLOUD_ORIGIN` | `http://127.0.0.1:3210` (or `http://YOUR_SERVER_IP:3210` if browsers are not on the same machine) |
| `CONVEX_SITE_ORIGIN` | **Keep** `http://127.0.0.1:3211` (JWT issuer the backend fetches from inside the container). Do **not** set this to a LAN IP — Docker hairpin NAT breaks auth discovery. Do not set `CONVEX_SITE_URL` yourself. |
| `NEXT_PUBLIC_DEPLOYMENT_URL` | Same as `CONVEX_CLOUD_ORIGIN` — used by the **dashboard** UI in the browser |
| `VITE_CONVEX_URL` | Same as `CONVEX_CLOUD_ORIGIN` (baked into the site image at build time) |
| `CONVEX_IMAGE_TAG` | Leave the value from [`.env.example`](../.env.example) unless you intentionally upgrade |
| `AUTH_PASSWORD_ENABLED` | `false` (default) or `true` for email/password instead of Google |

Optional later (Google only when password auth is off):

```text
AUTH_PASSWORD_ENABLED=false
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
```

For email/password self-host auth:

```text
AUTH_PASSWORD_ENABLED=true
CONVEX_SITE_ORIGIN=http://127.0.0.1:3211
```

You can copy the full list from [`.env.example`](../.env.example). Do **not** upload a committed `.env` with real secrets into git.

**URL tip:** Values used by the **browser** (`VITE_CONVEX_URL`, `NEXT_PUBLIC_DEPLOYMENT_URL`, `CONVEX_CLOUD_ORIGIN`, `SITE_URL`, etc.) must be reachable from the user’s machine. Never use Docker-internal names like `http://backend:3210` there. Use `http://127.0.0.1:...` only when the browser is on the Docker host; from another LAN device use `http://YOUR_SERVER_IP:...` for those browser-facing vars — but leave `CONVEX_SITE_ORIGIN` on loopback.

---

## 3. Deploy the stack

1. Click **Deploy the stack**.
2. First deploy pulls Convex images and builds `web` / `deploy` — often **5–15 minutes**.
3. Watch progress:
   - **Stacks** → your stack → containers
   - Open logs for `admin-key` and `deploy` (they should exit with code **0**)
   - `backend`, `dashboard`, and `web` should stay **running**

A successful `deploy` log ends with something like `Deploy complete`.

---

## 4. Get the dashboard admin key

Bootstrap files (including the admin key) are stored in the Docker named volume **`bootstrap`** (full name is usually `<stack>_bootstrap`, e.g. `classclarus_bootstrap`).

### Option A — From deploy logs

1. **Containers** → select the exited `…deploy…` container  
2. **Logs**  
3. Look for the admin key / “Admin key written” lines

### Option B — Read the volume (recommended)

On the Docker host (or via Portainer’s console / a one-off container):

```bash
# List volumes to confirm the exact name
docker volume ls | grep bootstrap

# Print the admin key (replace the volume name if needed)
docker run --rm -v classclarus_bootstrap:/output alpine cat /output/admin_key
# Example output (paste all of this, including the name and |):
# convex-self-hosted|a1b2c3d4e5f6...
```

If your stack name differs, use the matching `*_bootstrap` volume from `docker volume ls`.

### Log in to the dashboard

The key is always:

```text
INSTANCE_NAME|hex
```

Example: `convex-self-hosted|a1b2c3d4e5f6...`. Paste the **entire** value (name, `|`, and hex) with no extra spaces or line breaks. **The hex alone will not work.**

1. Open `http://<host>:6791` (use the same host/IP you put in the stack env for browser URLs).
2. Paste the full admin key.

**LAN / another device:** The dashboard page runs in *your* browser and calls `NEXT_PUBLIC_DEPLOYMENT_URL`. If that is still `http://127.0.0.1:3210` while you open `http://YOUR_SERVER_IP:6791` from a laptop or phone, login fails even with a valid key.

1. Set `NEXT_PUBLIC_DEPLOYMENT_URL` (and the other browser URLs) to `http://YOUR_SERVER_IP:3210` / matching ports.
2. Update the stack so **`dashboard` is recreated** (not only `web`).
3. Retry login with the full key.

From the client machine, confirm the API is reachable:

```bash
curl http://YOUR_SERVER_IP:3210/version
```

---

## 5. Open the app

- Website: `http://<host>:3000`
- Dashboard: `http://<host>:6791`

Quick API check:

```bash
curl http://127.0.0.1:3210/version
```

---

## Enable email/password sign-in (self-host)

1. In Portainer → your stack env vars, set:

   ```text
   AUTH_PASSWORD_ENABLED=true
   CONVEX_SITE_ORIGIN=http://127.0.0.1:3211
   ```

   Keep `CONVEX_SITE_ORIGIN` on loopback even when other URLs use a LAN IP. A LAN IP issuer breaks auth discovery inside the backend container (Docker hairpin NAT).

2. **Update the stack** so `backend`, `deploy`, and `web` recreate/rebuild (backend must pick up the issuer; the SPA bakes `VITE_AUTH_PASSWORD_ENABLED`).
3. Open `/login` — email/password registration and sign-in appear instead of Google.
4. From the Docker host, confirm discovery inside the backend:

   ```bash
   sudo docker exec "$(sudo docker ps -q --filter name=backend | head -n 1)" \
     curl -sf http://127.0.0.1:3211/.well-known/openid-configuration
   ```

   Expect JSON whose `issuer` is `http://127.0.0.1:3211`. The `deploy` job also smoke-checks discovery and fails the stack if a non-loopback issuer is unreachable.
5. If you still see `Auth provider discovery … failed`, the stack almost certainly still has a LAN IP in `CONVEX_SITE_ORIGIN` — fix that and recreate `backend` + `deploy` (see [self-hosting.md](self-hosting.md#3-verify-auth-discovery-after-signup)).
6. There is **no** self-service password reset. Admins reset passwords in the Convex dashboard by running **`adminAuth:resetPassword`** with `email` and `newPassword` (min 8 characters). Existing passwords cannot be read — only replaced.

Full details: [self-hosting.md](self-hosting.md#enable-emailpassword-sign-in-self-host).

---

## Enable Google sign-in (optional)

> **Do not combine with password mode:** leave `AUTH_PASSWORD_ENABLED=false` (or unset) when using Google.

> **Host machine only:** Sign in with Google works only when you open the app on the **Docker host** (e.g. `http://localhost:3000`). It will **not** work from a phone, laptop, or other device on your LAN. For Google login from other devices, use a real domain with HTTPS — see [self-hosting.md](self-hosting.md#public-server--domain).

1. In [Google Cloud Console](https://console.cloud.google.com/) create a **Web application** OAuth client.
2. Authorized JavaScript origin: your `SITE_URL` (local: `http://localhost:3000`). For a public domain, use that origin instead.
3. Authorized redirect URI:

   ```text
   <CONVEX_SITE_ORIGIN>/api/auth/callback/google
   ```

   Local-style default: `http://127.0.0.1:3211/api/auth/callback/google`

4. In Portainer → your stack → **Editor** / env vars, set:

   ```text
   AUTH_PASSWORD_ENABLED=false
   AUTH_GOOGLE_ID=...
   AUTH_GOOGLE_SECRET=...
   ```

5. **Update the stack** (recreate so `deploy` and `web` run again with the new env).

Details and production URLs: [self-hosting.md](self-hosting.md#enable-sign-in-with-google-optional).

---

## Update and redeploy

### Pull new code from Git

1. **Stacks** → your stack  
2. Use **Pull and redeploy** (wording varies by Portainer version) so the Git checkout refreshes and services rebuild as needed.

### After changing public URLs

- If you change `VITE_CONVEX_URL` / `CONVEX_CLOUD_ORIGIN` / related vars, you must **rebuild `web`** (Vite bakes the URL at image build time). Pull/redeploy with build, or force recreate the `web` service so it rebuilds.
- If you change `NEXT_PUBLIC_DEPLOYMENT_URL` (required for LAN dashboard login), **recreate `dashboard`** as well — that value is read by the dashboard UI in the browser. Updating only `web` is not enough for dashboard login.

### After changing only `convex/` backend code

Updating the stack so the `deploy` service runs again is enough (it pushes functions to the self-hosted backend).

---

## Backups

In Portainer → **Volumes**, protect at least:

| Volume | Contents |
|--------|----------|
| `*_data` | Convex SQLite / app data |
| `*_bootstrap` | `admin_key`, JWT files |

Also store your stack env (especially `INSTANCE_SECRET`) somewhere safe outside Portainer.

Losing `INSTANCE_SECRET` or the `data` volume can make the instance unrecoverable.

More backup examples: [self-hosting.md](self-hosting.md#back-up-your-data).

---

## Troubleshooting

### `unable to clone git repository: reference not found`

Portainer expects a full Git ref, not a bare branch name. For this project set **Repository reference** to:

```text
refs/heads/main
```

Using just `main` (or `master` / `origin/main`) commonly produces this error even when the branch exists. You can also clear the field and let Portainer use the default `HEAD`.

For this repo, use:

| Field | Value |
|-------|--------|
| Repository URL | `https://github.com/mjf1406/classclarus-convex.git` |
| Compose path | `docker-compose.yml` |
| Repository reference | `refs/heads/main` |

If it still fails after fixing the ref:

- Wrong or mistyped Repository URL (empty fork, different repo, or a GitHub **web** path like `.../tree/main`)
- SSH URL without a deploy key / credentials in Portainer
- Private fork with no PAT or credentials configured
- Docker host cannot reach GitHub (DNS, firewall, or proxy)

From the Docker host (or any machine that can reach GitHub), verify the ref exists:

```bash
git ls-remote https://github.com/mjf1406/classclarus-convex.git HEAD refs/heads/main
```

You should see a commit SHA for both lines. If that fails on the host, Portainer will fail too. Fix the URL/auth/network, then redeploy the stack.

### Stack fails because images cannot build

- Confirm you used **Repository** deploy, not a bare compose paste without source.
- Confirm `Dockerfile` and `docker/Dockerfile.deploy` exist on the branch you selected.
- Check Portainer build logs for the `web` / `deploy` services.

### Deploy stuck on `Pulling` / `Waiting` (truncated error)

Portainer often truncates the real error during the first image pull. On the Docker host:

```bash
sudo docker pull ghcr.io/get-convex/convex-backend:abdd9b30f89c0e7c18c4213b99cd10e4bad33f8c
sudo docker pull ghcr.io/get-convex/convex-dashboard:abdd9b30f89c0e7c18c4213b99cd10e4bad33f8c
```

Use `sudo` if you see `permission denied` on `/var/run/docker.sock`. After pulls succeed, redeploy the stack (images are cached). Check disk with `df -h` if pulls fail with no space left.

### `deploy` exited with an error

Portainer may **remove** failed containers, so `docker logs classclarus-deploy-1` can say the container does not exist. Capture logs by running deploy on the host instead:

```bash
cd /path/to/classclarus-convex   # or clone fresh under /tmp
# .env must include INSTANCE_SECRET (same as Portainer)
sudo docker compose up -d backend
sudo docker compose up --build admin-key
sudo docker compose up --build deploy
```

Watch for `Deploy complete`. If you see `Could not resolve "#/lib/..."` bundling errors, the branch is too old — pull latest `main` (Convex code must not import frontend `#/` aliases).

In Portainer, after a successful host deploy, update/redeploy the stack (or keep using Compose). `web` only starts after `deploy` exits 0.

### `INSTANCE_SECRET` error

Add `INSTANCE_SECRET` in the stack environment (64-character hex from `openssl rand -hex 32`), then update the stack.

### Private Git repository auth errors

Configure Git credentials in Portainer for that stack/repo (PAT or deploy key, depending on your host).

### Ports already allocated

Change `WEB_PORT`, `PORT`, `SITE_PROXY_PORT`, `DASHBOARD_PORT` in stack env, and update matching `CONVEX_*` / `VITE_CONVEX_URL` / `SITE_URL` values. Rebuild `web` after URL changes.

### Website cannot reach Convex

`VITE_CONVEX_URL` must be a URL the **browser** can open (host IP or domain), not `http://backend:3210`. Fix env → rebuild `web`.

### Signed in but home page never leaves the loader / jumps to Sign in

Usually `Auth provider discovery of http://…:3211 failed`. Cause: `CONVEX_SITE_ORIGIN` is a LAN IP the backend cannot reach from inside Docker (hairpin NAT). Fix:

1. Set `CONVEX_SITE_ORIGIN=http://127.0.0.1:3211`.
2. Keep LAN IPs only on browser-facing vars (`VITE_CONVEX_URL`, `CONVEX_CLOUD_ORIGIN`, `SITE_URL`, `NEXT_PUBLIC_DEPLOYMENT_URL`).
3. Update the stack so **backend** and **deploy** recreate.
4. Confirm: `sudo docker exec … curl -sf http://127.0.0.1:3211/.well-known/openid-configuration` returns a loopback `issuer`.

Details: [self-hosting.md](self-hosting.md#3-verify-auth-discovery-after-signup).

### Dashboard rejects the key

Common causes (a valid key still fails for the last two):

- Pasted only the hex — must paste the **full** key: `INSTANCE_NAME|hex` (example `convex-self-hosted|a1b2...`), including the `|`
- Opened `http://YOUR_SERVER_IP:6791` from another machine while `NEXT_PUBLIC_DEPLOYMENT_URL` is still `http://127.0.0.1:3210` — set it to `http://YOUR_SERVER_IP:3210`, update the stack, **recreate `dashboard`**, then retry
- Re-read `admin_key` from the `*_bootstrap` volume (Option B above) in case of a copy/paste error
- Changed `INSTANCE_SECRET` after first boot — update the stack so `admin-key` and `deploy` run again, then use the new key

### Reset the stack (destructive)

In Portainer, remove the stack and **delete unused volumes** only if you intend to wipe data (`data` + `bootstrap`). Then create the stack again from Git.

---

## Related docs

- [CLI Docker Compose guide](self-hosting.md)
- [`.env.example`](../.env.example)
- [`docker-compose.yml`](../docker-compose.yml)
- [Portainer documentation](https://docs.portainer.io/)
