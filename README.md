# ClassClarus

## Self-hosting (Docker)

Get the full stack running locally with Docker:

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose).
2. Copy config and set a secret:

   ```bash
   cp .env.example .env
   openssl rand -hex 32
   # paste the output into INSTANCE_SECRET in .env
   ```

3. Start:

   ```bash
   docker compose up -d --build
   ```

4. Open **http://localhost:3000** (app) and **http://localhost:6791** (dashboard).  
   Dashboard admin key:

   ```bash
   docker run --rm -v classclarus-convex_bootstrap:/output alpine cat /output/admin_key
   ```

**Guides:**

- [docs/self-hosting.md](docs/self-hosting.md) — CLI Docker Compose (Google login, domains, backups, troubleshooting)
- [docs/self-hosting-portainer.md](docs/self-hosting-portainer.md) — Portainer Git stack deploy

## Useful Links

- [Shadcn Preset](https://ui.shadcn.com/create?preset=bbZ0kFM&template=vite&pointer=true)

## To Do

- add a minimal shadcn sidebar app layout shell with breadcrumbs in the header
- somehow make Convex queries automatically optimistic

## Change Log

### 2026-06-26

- installed and initialized Convex
- installed and initialized shadcn preset
- installed and initialized Tanstack Router
