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
| `OSRM_URL` | Road-routing server for pickup-time calc. Default `https://router.project-osrm.org` (demo — rate-limited; self-host for prod). Empty = always use the distance estimate. Host must be reachable (egress). |
| `OSRM_TIMEOUT_MS` | Per-request routing timeout before the estimate fallback (default `4000`). |

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
   with that phone and **Add child** for each kid — dropping a pin on the home
   and entering the parent's phone (no route to set up). Then **Arrange order &
   pickup times**: order the kids and set a school-arrival time, and the app
   computes every child's pickup time.
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

## SMS delivery — turn on real login codes (Twilio)

Login is phone + SMS code. In the **default `console` mode no text is sent** (the
code is only logged), so **drivers and parents on their own phones can't log in.**
Enable Twilio for any real deployment:

1. **Create a Twilio account** — https://www.twilio.com/try-twilio (pay-as-you-go;
   roughly ~$1/mo per number + a few cents per message).
2. **Set up a sender that can text Lebanon (+961):**
   - Turn on Lebanon under **Messaging → Settings → Geo permissions**.
   - Use a Twilio **phone number** with SMS enabled, **or** an **Alphanumeric
     Sender ID** (e.g. `BusMapp`) — alphanumeric often works best for +961 and
     needs no number (recipients just can't reply, which is fine for codes).
3. **Copy credentials** from the Twilio Console: `ACCOUNT SID` + `AUTH TOKEN`.
4. **Set env vars on your host** (Render → service → **Environment**), then save
   (the host redeploys):
   ```
   SMS_PROVIDER=twilio
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_FROM=+1XXXXXXXXXX      # your Twilio number, OR an alphanumeric ID like BusMapp
   ```
5. **Test:** on the app's login screen, request a code for a real +961 number — a
   text should arrive in seconds. If it doesn't, open Twilio Console → **Monitor →
   Logs → Messaging** for the reason.

Gotchas:
- **Trial accounts** can only text numbers you've *verified* in Twilio and add a
  "trial account" prefix. Add funds to send to anyone.
- Keep `TWILIO_AUTH_TOKEN` in the host's secret store — never in git.
- How to confirm which mode is live: if a requested code arrives by SMS, you're on
  Twilio; if nothing arrives, you're still on `console`. (Implementation:
  `TwilioSmsProvider` in `server/src/auth/sms/sms-provider.ts`.)

## Road routing — self-host OSRM (recommended for real times)

Pickup times use **OSRM** for real road driving times. The default
`OSRM_URL=https://router.project-osrm.org` is a **rate-limited demo** — fine to
try, not for production. Run your own with a Lebanon extract (Docker; ~30 MB
download, a couple minutes to preprocess, tiny RAM):

```bash
# 1. Lebanon road network from Geofabrik
mkdir -p osrm && cd osrm
curl -L -o lebanon-latest.osm.pbf \
  https://download.geofabrik.de/asia/lebanon-latest.osm.pbf

# 2. Preprocess with the car profile (MLD pipeline — easy monthly updates)
docker run --rm -t -v "${PWD}:/data" osrm/osrm-backend \
  osrm-extract -p /opt/car.lua /data/lebanon-latest.osm.pbf
docker run --rm -t -v "${PWD}:/data" osrm/osrm-backend \
  osrm-partition /data/lebanon-latest.osrm
docker run --rm -t -v "${PWD}:/data" osrm/osrm-backend \
  osrm-customize /data/lebanon-latest.osrm

# 3. Serve on :5000 (stays up, restarts with the host)
docker run -d --name osrm --restart unless-stopped \
  -p 5000:5000 -v "${PWD}:/data" \
  osrm/osrm-backend osrm-routed --algorithm mld /data/lebanon-latest.osrm
```

Verify, then point the API at it:

```bash
# Expect "code":"Ok" and a routes[0].legs[0].duration
curl "http://localhost:5000/route/v1/driving/35.50,33.89;35.48,33.90?overview=false"

# Then set on the API host (private address if same network) and redeploy:
#   OSRM_URL=http://<osrm-host>:5000
```

After redeploy, click **Save order & times** in the dashboard — the confirmation
should read **"from live road data."** If it says "estimated," the API host
can't reach `OSRM_URL` (check egress/firewall and that the container is up).

- **docker-compose:** add a service `osrm: { image: osrm/osrm-backend, command: osrm-routed --algorithm mld /data/lebanon-latest.osrm, volumes: ["./osrm:/data"], ports: ["5000:5000"] }` and set the API's `OSRM_URL=http://osrm:5000`.
- **Keeping it current:** re-run the three preprocess steps on a fresh
  `lebanon-latest.osm.pbf` monthly (a cron), then restart the `osrm` container.

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
