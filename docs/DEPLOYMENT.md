# Deployment Runbook — going live on a VPS/cloud server

Follow this top to bottom for the first go-live. See `docs/OPERATIONS.md` for
ongoing maintenance (backups, rotating secrets, day-to-day notes) once this
is done, and its "Support contract / license" section for issuing the
client's AMC license after launch.

This assumes a Linux VPS (Ubuntu/Debian commands shown; adjust for your
distro) with a public IP, and a domain you can point at it.

`docker-compose.prod.yml` is a **complete, standalone** compose file (not
layered on top of the base `docker-compose.yml` used for local dev) — see
the comment at the top of that file for why. Every command below targets it
via the `COMPOSE_FILE` setting from step 4, so plain `docker compose ...`
(no `-f`) always does the right thing on this server.

## 0. Prerequisites

- A domain or subdomain for the client (e.g. `erp.clientinstitute.com`).
- SSH access to the VPS with a non-root sudo user.
- Docker + Docker Compose installed on the VPS:
  ```bash
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER    # log out/in after this
  ```
  (Docker Compose v2 is bundled with modern Docker installs as `docker compose`.)

## 1. Point DNS at the server

Create an **A record** for the domain pointing at the VPS's public IP.
Confirm it's resolving before continuing — Caddy's automatic HTTPS
(step 5) will fail its certificate request otherwise:
```bash
dig +short erp.clientinstitute.com
```

## 2. Open the firewall

Only 22 (SSH), 80, and 443 need to be reachable from the internet —
`docker-compose.prod.yml` publishes no other ports (Postgres, the API, and
the web container are only reachable from other containers on the compose
network), so there's nothing else to open:
```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## 3. Get the code onto the server

Either clone from your git remote, or copy the working tree directly:
```bash
git clone <your-repo-url> erp_diploma && cd erp_diploma
# or, from your machine:
#   rsync -avz --exclude node_modules --exclude dist ./ user@server:erp_diploma/
```

## 4. Configure production environment

```bash
cp .env.example .env
```
Edit `.env` and set (see `.env.example` for the full list):

| Variable | Production value |
|---|---|
| `COMPOSE_FILE` | Add this line: `COMPOSE_FILE=docker-compose.prod.yml` — makes every bare `docker compose ...` command on this server target the production stack automatically |
| `SESSION_SECRET` | A **new** value, never the one from local dev — generate with `openssl rand -base64 48` |
| `POSTGRES_PASSWORD` | A **new**, long random value — generate with `openssl rand -base64 32`. This database is not exposed publicly, but don't reuse the local-dev password anyway |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | A real password you'll change immediately after first login (step 8) |
| `DOMAIN` | The domain from step 1 |
| `LETSENCRYPT_EMAIL` | Your email — Let's Encrypt uses this for renewal/expiry notices |
| `VENDOR_SUPPORT_CONTACT` | How the client should reach you — shown in the in-app license banner |
| `LICENSE_SERVER_URL` / `LICENSE_KEY` | Your license server's URL, and the key issued for this specific client — see step 8 and `apps/license-server/README.md`. Can be left blank for now and filled in after first launch |

`COOKIE_SECURE` and `APP_BASE_URL` in `.env.example` are for local dev —
`docker-compose.prod.yml` sets both correctly itself (`true` and
`https://$DOMAIN`), so leave them as-is; they're unused in production.

Never commit this `.env` — it has real secrets in it.

## 5. First-time build and bring-up

```bash
# Build images (this bakes DOMAIN into the frontend's API URL — see
# apps/web/Dockerfile's comment on VITE_API_BASE_URL being build-time only):
docker compose build

# Start Postgres first and wait for it to be healthy, then run migrations + seed:
docker compose up -d postgres
docker compose run --rm migrate

# Bring up everything else (server, web, Caddy):
docker compose up -d
```

## 6. Verify

```bash
docker compose logs -f caddy
```
Look for Caddy obtaining a certificate (no repeated errors about the ACME
challenge failing — if it's failing, re-check step 1's DNS and step 2's
firewall). Then from your own machine:
```bash
curl -I https://erp.clientinstitute.com
```
Should return `200`. Load it in a browser and log in with the seed admin
credentials from `.env`.

## 7. Ongoing deploys (after this first one)

```bash
git pull   # or re-sync the tree
docker compose up -d --build
# Run this only if the update includes a migration:
docker compose run --rm migrate
```
A brief restart of `server`/`web` happens on each deploy — acceptable for
this scale; there's no zero-downtime mechanism here by design.

## 8. Immediately after first launch

- **Log in and change the seeded admin password** — don't leave
  `SEED_ADMIN_PASSWORD` from `.env` as the live credential.
- **Schedule database backups** — see `docs/OPERATIONS.md` "Backups"; on a
  Linux VPS a cron entry running `docker compose exec postgres pg_dump ...`
  to off-server storage is the minimum bar.
- **Issue the client's AMC license** (if not already done in step 4) — see
  `apps/license-server/README.md`. Create it via your license server's
  `admin.html` or the admin API, then set `LICENSE_SERVER_URL`/`LICENSE_KEY`
  in this client's `.env` and restart (`docker compose up -d`). No need to
  collect this server's instance id upfront — it reports itself
  automatically on its first check-in.
