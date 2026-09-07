# Operations Runbook

Covers backing up and restoring the database, and moving the system from a
local/on-premise install to a hosted server. See `.env.example` for every
configuration knob referenced below.

## Backups

All application data (students, courses, fees, exam results, everything)
lives in the PostgreSQL database. Uploaded student photos live separately on
disk (or in S3, once `STORAGE_DRIVER=s3` is implemented) — back up both.

### Manual backup

```bash
# From the machine running Postgres, or with psql client tools installed:
pg_dump "postgresql://erp_user:erp_password@localhost:5432/erp_diploma" \
  --format=custom --file="erp_diploma_$(date +%Y%m%d_%H%M%S).dump"
```

Use `--format=custom` (not plain SQL) — it's compressed and restores faster
with `pg_restore`, including selective table restores if you ever need one.

### Scheduled backup (local/on-premise deployment)

There's no built-in scheduler for this (it's an OS-level concern, not an
application one). On Windows, use Task Scheduler to run a `.bat`/PowerShell
script daily that calls `pg_dump` and copies the result to a **different
disk or machine** than the one running Postgres — a backup on the same disk
doesn't protect against disk failure. On Linux, a cron entry works the same
way. Keep at least 7 daily + 4 weekly backups, more if disk space allows.

This matters most in the local-server phase, before Phase where a managed
hosted Postgres would provide automatic backups.

### Restore

```bash
# Into a fresh, empty database:
createdb -U erp_user erp_diploma_restored
pg_restore --dbname="postgresql://erp_user:erp_password@localhost:5432/erp_diploma_restored" \
  --no-owner --no-privileges erp_diploma_20260716_090000.dump
```

Restore into a **new** database name first, verify the data looks right,
then swap `DATABASE_URL` to point at it (or rename databases) rather than
restoring directly over a live database.

### Uploaded files (student photos)

If `STORAGE_DRIVER=local`, back up the directory at `STORAGE_LOCAL_PATH`
(default `./data/uploads`) alongside the database dump — a restored database
with no matching photo files will show broken images. Photo storage keys
are relative paths (e.g. `students/<id>/photo.jpg`), not absolute paths, so
copying the directory as-is is sufficient.

## Moving from local to a hosted server

The app is deliberately configured entirely through environment variables
(see `.env.example`) so this is a deployment-target change, not a code
change. **For the concrete step-by-step go-live runbook (DNS, firewall,
Caddy/HTTPS, first bring-up, post-launch checklist), see
`docs/DEPLOYMENT.md`.** The notes below are the underlying concepts that
runbook is built on:

- **Postgres**: either the containerized `postgres` service in
  `docker-compose.yml`, or a managed Postgres — the latter usually requires
  `DATABASE_SSL=true`.
- **Migrations**: the `server` image's runtime stage deliberately excludes
  migration tooling (see "Day-to-day operational notes" below), so
  migrations always run against the `build` stage via the dedicated one-off
  service: `docker compose run --rm migrate`.
- **Secrets**: a freshly generated `SESSION_SECRET` on every new
  environment, never reused from local dev.
- **HTTPS**: `docker-compose.prod.yml` adds Caddy in front of `server`/`web`
  for automatic Let's Encrypt HTTPS — neither container terminates TLS
  itself. This also requires `app.set('trust proxy', 1)` in production (see
  `apps/server/src/app.ts`) so Express recognizes the connection as secure
  once Caddy forwards it — without that, `COOKIE_SECURE=true` silently
  breaks logins.
- **File storage**: `STORAGE_DRIVER=local` works on a single hosted VM as
  long as `STORAGE_LOCAL_PATH` points at a persisted volume (not ephemeral
  container storage that resets on redeploy). Moving to S3-compatible
  storage later needs no data migration — see
  `apps/server/src/lib/storage/` — because storage keys are
  driver-agnostic; only `S3CompatibleStorage` needs implementing, and
  `STORAGE_DRIVER=s3` flips the switch.
- **Notifications**: still `console` (logs only) until a real SMS/email
  gateway is wired in — see `apps/server/src/lib/notify/`. Adding one is a
  new class implementing `NotificationProvider`; no changes needed at any
  call site.

## Support contract / license

The license check gates nothing but a banner — it never blocks logins, data
entry, or reports, even when missing, expired, or unreachable. Locking an
institute out of its own live student/fee/attendance data over a lapsed
support contract is a billing conversation, not something the software
should enforce. What it does give you: a clear signal (to the client, and
in the server logs) of when the support contract needs renewing, real-time
AMC enforcement (renew by editing one record, not by shipping a file), and
a way to notice if the same license key is running on more than one
deployment.

**How it works**: `apps/license-server/` is a small separate service —
deployed **once**, on your own infrastructure, shared across every client
you have (not part of any client's own deployment). Each client's ERP
instance calls it once daily (`apps/server/src/lib/license/checkin.ts`,
scheduled in `lib/scheduler.ts`) with its license key and a randomly
generated instance id (persisted the same way as before — survives
restarts/rebuilds, doesn't travel with a fresh separate deployment), and
caches the result locally so a slow or briefly-unreachable license server
never affects the running app (see `LICENSE_CACHE_PATH`; a stale cache
older than 14 days is what eventually shows an "unreachable" banner, not an
instant flip). See `apps/license-server/README.md` for the full setup and
day-to-day admin workflow (issuing, renewing, suspending), summarized here:

```bash
# Issue a new client's license (their instance id isn't needed for this —
# their server reports it automatically on its first check-in):
curl -X POST https://license.yourdomain.example/api/v1/admin/licenses \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"clientName": "Client Institute Name", "days": 365}'
# -> returns a license_key. Set it as LICENSE_KEY in the client's .env,
#    alongside LICENSE_SERVER_URL pointing at your license-server.
```

**Renewing** (the actual AMC workflow, yearly) — no file to generate or
send:
```bash
curl -X PATCH https://license.yourdomain.example/api/v1/admin/licenses/<key> \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"extendDays": 365}'
```
The client's instance picks this up automatically on its next daily
check-in. The `admin.html` page served by the license-server does the same
thing without needing curl.

**Where to check things**: `GET /api/v1/license/status` (any authenticated
user), and a one-line summary logged at server startup.

## Day-to-day operational notes

- **Rotating `SESSION_SECRET`** invalidates every active session (everyone
  gets logged out) — plan for it, don't do it during business hours.
- **Re-running `npm run seed`** is safe at any time: permissions and the
  `Admin` role are idempotently upserted, and the super-admin bootstrap
  account is only created once (skipped if the `staff` table already has
  rows).
- **Database migrations** (`npm run migrate`) must be run manually before
  starting a new version of the server that depends on schema changes —
  there's no auto-migrate-on-boot, by design, so a bad migration can't take
  down a running server silently.
- **Archiving a course batch** (`status = 'archived'`) is a display/workflow
  flag only — it blocks new enrollments into that batch but every historical
  record (fees, attendance, exam results) for students who were in it
  remains fully queryable and shows up in reports exactly as before.
