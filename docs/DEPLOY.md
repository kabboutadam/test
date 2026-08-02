# Deploying the BusMapp API

Give the backend a public HTTPS URL so the mobile app (backend mode) and the
operator dashboard can reach it. The server is containerized (`server/Dockerfile`)
and ships configs for **Render**, **Railway**, and **Fly.io** — pick one.

## What the server needs

| Env var | Purpose |
| --- | --- |
| `PORT` | Set by the platform; the app reads it (local default 3000). |
| `JWT_SECRET` | Signing secret for auth tokens. **Use a strong random value.** |
| `SUPERADMIN_PHONES` | Comma-separated platform-owner phone(s) — **your number**. Only these can create schools + logins. |
| `USE_PRISMA` | `true` to use Postgres (recommended in prod), else in-memory. |
| `DATABASE_URL` | Postgres connection string (when `USE_PRISMA=true`). |
| `SEED_ON_START` | `true` to load the Beirut demo data on boot (idempotent). |
| `SMS_PROVIDER` | `console` (default, logs code) or `twilio` (real texts). |
| `TWILIO_*` | `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` for Twilio. |

On boot with `USE_PRISMA=true`, the container runs `prisma db push` to sync the
schema, then seeds if `SEED_ON_START=true` (see `server/scripts/start.sh`).
`db push` is fine to get started; adopt migrations (`prisma migrate`) later.

Health check: **`GET /api/health`** → `{ "ok": true }`.

---

## Option A — Render (one file, includes Postgres)

`render.yaml` (repo root) defines the web service **and** a Postgres database,
wiring `DATABASE_URL` and generating `JWT_SECRET` automatically.

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → select the repo. It reads `render.yaml`.
3. Approve. Render builds `server/Dockerfile`, provisions Postgres, and deploys.
4. Your URL: `https://busmapp-api.onrender.com` (or similar). Check
   `https://<url>/api/health` and open `https://<url>/admin.html`.

> Render's free Postgres/web tiers sleep when idle and expire after a while —
> fine for testing; use paid plans for anything real.

## Option B — Railway

Uses `server/railway.json` (Dockerfile build + health check).

```bash
npm i -g @railway/cli
railway login
railway init                       # create a project
railway add --database postgres    # provisions Postgres, sets DATABASE_URL
railway up --path-as-root server   # build & deploy the server/ directory
```

Then in the Railway dashboard set variables on the service: `USE_PRISMA=true`,
`SEED_ON_START=true`, `JWT_SECRET=<random>`. Generate a domain (Settings →
Networking) to get the public URL.

## Option C — Fly.io

Uses `server/fly.toml`. From the `server/` directory:

```bash
fly launch --no-deploy             # keep the existing fly.toml
fly postgres create                # create a Postgres cluster
fly postgres attach <cluster>      # sets DATABASE_URL
fly secrets set USE_PRISMA=true SEED_ON_START=true JWT_SECRET=$(openssl rand -hex 32)
fly deploy
```

Get the URL with `fly info` (e.g. `https://busmapp-api.fly.dev`).

---

## After it's live — onboard your first school (all clickable)

1. **Verify:** `curl https://<your-url>/api/health` → `{"ok":true}`.
2. **Sign in as yourself (super-admin):** open `https://<your-url>/admin.html`
   and sign in with the phone you put in `SUPERADMIN_PHONES`. You get the
   **Platform** panel.
   - In console-SMS mode the code auto-fills; with Twilio it's texted to you.
3. **Create a school:** type its name, **tap the map** to drop it anywhere in
   Lebanon, Create. Then **+ Add login** and enter the school manager's phone.
4. **The school takes over (on their phone or the dashboard):** they sign in
   with that phone, tap **New route** (just a name), then **Add child** for each
   kid — dropping a pin on the home and entering the parent's phone.
5. **Parents** sign in with the phone the school entered and track their kid.
   Movement is simulated per route until a driver streams real GPS, so tracking
   works immediately.
6. **Point the app at your server** — in `app.json`:
   ```json
   "extra": {
     "useBackend": true,
     "apiBaseUrl": "https://<your-url>"
   }
   ```
   Then rebuild for TestFlight (`docs/TESTFLIGHT.md`). The app now shows the
   phone-OTP login and routes each role (parent / school) to the right place.

> ⚠️ **Before inviting real people, switch SMS to Twilio.** With
> `SMS_PROVIDER=console` the login code is returned in the API response, so
> anyone could log in as a known number. Set `SMS_PROVIDER=twilio` +
> `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` (a real Twilio
> number) so codes are texted. For a Lebanese aggregator instead, implement
> `SmsProvider` against their HTTP API and select it in `createSmsProvider`.

**Push delivery:** the host must allow outbound HTTPS to `exp.host` (most do by
default). Remote push also needs the EAS `projectId` + a physical device.

## Notes

- **Turn off `SEED_ON_START`** once you have real data, so boots don't re-upsert
  demo rows.
- **Secrets:** never commit `.env`; set `JWT_SECRET`/`DATABASE_URL` in the
  platform's secret store. `render.yaml` generates `JWT_SECRET` for you.
- **Scaling the socket:** a single instance is fine to start. Multiple instances
  need a shared adapter (e.g. Redis) so Socket.IO rooms span instances — a Phase 5
  item.
- **CORS** is open (`*`) for the API; fine for native apps. Restrict if you add a
  browser client on another origin.
