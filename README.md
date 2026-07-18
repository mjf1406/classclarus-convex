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
   Dashboard admin key: `.convex-self-hosted/admin_key`

**Full step-by-step guide** (Google login, domains, backups, troubleshooting):  
[docs/self-hosting.md](docs/self-hosting.md)

## Useful Links

- [Shadcn Preset](https://ui.shadcn.com/create?preset=bbZ0kFM&template=vite&pointer=true)