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
| `CONVEX_SITE_ORIGIN` | `http://127.0.0.1:3211` (same idea as above) |
| `NEXT_PUBLIC_DEPLOYMENT_URL` | Same as `CONVEX_CLOUD_ORIGIN` |
| `VITE_CONVEX_URL` | Same as `CONVEX_CLOUD_ORIGIN` (baked into the site image at build time) |
| `CONVEX_IMAGE_TAG` | Leave the value from [`.env.example`](../.env.example) unless you intentionally upgrade |

Optional later:

```text
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
```

You can copy the full list from [`.env.example`](../.env.example). Do **not** upload a committed `.env` with real secrets into git.

**URL tip:** Values used by the **browser** (`VITE_CONVEX_URL`, `CONVEX_CLOUD_ORIGIN`, `SITE_URL`, etc.) must be reachable from the user’s machine. Never use Docker-internal names like `http://backend:3210` there.

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
```

If your stack name differs, use the matching `*_bootstrap` volume from `docker volume ls`.

### Log in to the dashboard

1. Open `http://<host>:6791`
2. Paste the **entire** admin key (no extra spaces)

---

## 5. Open the app

- Website: `http://<host>:3000`
- Dashboard: `http://<host>:6791`

Quick API check:

```bash
curl http://127.0.0.1:3210/version
```

---

## Enable Google sign-in (optional)

1. In [Google Cloud Console](https://console.cloud.google.com/) create a **Web application** OAuth client.
2. Authorized JavaScript origin: your `SITE_URL` (e.g. `http://localhost:3000` or `http://YOUR_IP:3000`).
3. Authorized redirect URI:

   ```text
   <CONVEX_SITE_ORIGIN>/api/auth/callback/google
   ```

   Local-style default: `http://127.0.0.1:3211/api/auth/callback/google`

4. In Portainer → your stack → **Editor** / env vars, set:

   ```text
   AUTH_GOOGLE_ID=...
   AUTH_GOOGLE_SECRET=...
   ```

5. **Update the stack** (recreate so `deploy` runs again with the new env).

Details and production URLs: [self-hosting.md](self-hosting.md#enable-sign-in-with-google-optional).

---

## Update and redeploy

### Pull new code from Git

1. **Stacks** → your stack  
2. Use **Pull and redeploy** (wording varies by Portainer version) so the Git checkout refreshes and services rebuild as needed.

### After changing public URLs

If you change `VITE_CONVEX_URL` / `CONVEX_CLOUD_ORIGIN` / related vars, you must **rebuild `web`** (Vite bakes the URL at image build time). Pull/redeploy with build, or force recreate the `web` service so it rebuilds.

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

### Dashboard rejects the key

- Re-read `admin_key` from the `*_bootstrap` volume (Option B above).
- If you changed `INSTANCE_SECRET`, update the stack so `admin-key` and `deploy` run again, then use the new key.

### Reset the stack (destructive)

In Portainer, remove the stack and **delete unused volumes** only if you intend to wipe data (`data` + `bootstrap`). Then create the stack again from Git.

---

## Related docs

- [CLI Docker Compose guide](self-hosting.md)
- [`.env.example`](../.env.example)
- [`docker-compose.yml`](../docker-compose.yml)
- [Portainer documentation](https://docs.portainer.io/)
