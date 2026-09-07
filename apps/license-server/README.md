# License Server

Your (the vendor's) own small central service — deployed **once**, separate
from any client's ERP deployment. Every client's ERP instance calls
`POST /api/v1/validate` periodically (see the main app's
`apps/server/src/lib/license/`) to check in; you manage each client's
status/expiry here directly. See the root `docs/OPERATIONS.md` → "Support
contract / license" for the full workflow this supports.

Deliberately simple: a plain JSON file as the datastore (no database server
at all — this handles a handful of clients with occasional writes, nowhere
near the scale that would justify one, and it sidesteps native-module build
fragility entirely), no admin user accounts (a single shared `ADMIN_TOKEN`
— this is a tool only you use), no build step for the admin page (plain
HTML/JS).

## Local development

```bash
cd apps/license-server
cp .env.example .env   # set a real ADMIN_TOKEN
npm run dev --workspace=apps/license-server
```
Open `http://localhost:4100/admin.html`, paste in the `ADMIN_TOKEN` when
prompted.

## Deploying (once, on your own infrastructure)

```bash
cd apps/license-server
cp .env.example .env   # set a real ADMIN_TOKEN — back this up somewhere safe
docker compose up -d --build
```
Put a reverse proxy in front for HTTPS (same Caddy pattern as the main
app's `docs/DEPLOYMENT.md`) — this container only serves plain HTTP itself.
Both the admin page and every client's check-in call cross the public
internet, so this must be HTTPS in production.

## Day-to-day: issuing and renewing licenses

Via `admin.html` (easiest), or directly:

```bash
# Issue a new license for a client:
curl -X POST https://license.yourdomain.example/api/v1/admin/licenses \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"clientName": "Sunrise Polytechnic Institute", "days": 365}'
# -> { "license_key": "...", ... } — give this key to the client, set as
#    LICENSE_KEY in their ERP's .env. No file to generate or send.

# Renew (AMC renewal — extends from the current expiry, not from today):
curl -X PATCH https://license.yourdomain.example/api/v1/admin/licenses/<key> \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"extendDays": 365}'

# Suspend (e.g. non-payment) / reactivate:
curl -X PATCH https://license.yourdomain.example/api/v1/admin/licenses/<key> \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"status": "suspended"}'
```

A client's ERP instance picks up any change (renewal, suspension) within
its own check-in interval (default: once daily) — nothing to redeploy or
send them.

## On detecting copied deployments

If a license's `last_seen_instance_id` in the admin listing changes
unexpectedly, or you notice a client checking in with a pattern that looks
like two servers alternating (rather than one server that was migrated
once), that's a signal — not a certainty — that the same license key is
running on more than one deployment. The check-in endpoint logs a warning
server-side whenever this happens, but never auto-blocks on it (a
legitimate redeploy or restore-from-backup also changes the instance id).
Investigate and use the suspend endpoint above if you conclude it's
unauthorized.
