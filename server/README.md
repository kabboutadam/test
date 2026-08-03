# BusMapp API (NestJS)

Fleet data, live bus positions, and subscriptions for the BusMapp mobile app.

## Run

```bash
npm install
cp .env.example .env
npm run dev      # ts-node, http://localhost:3000/api
# or
npm run build && npm start
```

Runs on in-memory seed data by default (no database needed).

**Deploying?** The server is containerized (`Dockerfile`) with one-file configs
for Render/Railway/Fly — see [`../docs/DEPLOY.md`](../docs/DEPLOY.md).

## REST

Public:

| Method | Path | Purpose |
| --- | --- | --- |
| GET  | `/api/health` | Liveness probe (`{ ok: true }`) |
| GET  | `/api/schools` | All schools |
| GET  | `/api/schools/:id/routes` | Routes at a school (onboarding) |
| GET  | `/api/routes` | All routes with stops |
| GET  | `/api/routes/:id` | One route |
| GET  | `/api/buses` | All buses |
| GET  | `/api/positions` | Snapshot of every bus position |
| GET  | `/api/positions/:routeId` | One bus's position |
| POST | `/api/driver/positions` | Driver GPS ingest (HTTP) — driver token + `{ routeId, points[] }`; used by the app's **background-location** task so tracking continues with the phone locked. Same auth + pipeline as the `driver:gps` socket. |
| GET  | `/api/driver/manifest` | The driver's **pickup list** for their own route, in order (name, address, time, parent phone). Driver token, route-scoped. |
| GET  | `/api/plans` | Subscription plans |

Auth:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/otp/request` | `{ phone }` → sends an OTP (returned as `devCode` outside production) |
| POST | `/api/auth/otp/verify` | `{ phone, code }` → `{ token, parentId }` |
| GET  | `/api/auth/me` | Echo the authenticated user (Bearer) |

Guarded — require `Authorization: Bearer <token>`, scoped to the token's parent:

| Method | Path | Purpose |
| --- | --- | --- |
| GET  | `/api/me/children` | The parent's children |
| POST | `/api/me/children` | Add a child (onboarding) |
| GET  | `/api/me/subscription` | Current subscription |
| POST | `/api/me/billing/checkout` | Start a checkout (creates a pending payment) |
| POST | `/api/me/billing/confirm` | Confirm payment → activates the subscription |
| POST | `/api/me/push-token` | Register this device's Expo push token |
| DELETE | `/api/me/push-token` | Unregister a push token |

Operator — require an **operator** token, scoped to the operator's school:

| Method | Path | Purpose |
| --- | --- | --- |
| GET  | `/api/admin/overview` | School, routes (bus/driver/child counts), totals |
| GET  | `/api/admin/positions` | Live status per route in the school |
| GET  | `/api/admin/children` | The school's kids, in pickup order |
| POST | `/api/admin/children` | Add a child (home pin + parent phone); `routeId` optional — picks the bus, else the first/auto one |
| PATCH | `/api/admin/children/:id` | Edit a child, move the pin, or move to another bus (`routeId`) |
| POST | `/api/admin/arrange` | Set one bus's pickup order (`routeId` + `childIds`) + `schoolArrival`; computes each child's time from road data (OSRM), estimate fallback |
| POST | `/api/admin/routes` | Create a bus/list (name only → school as destination); starts tracking |
| POST | `/api/admin/buses` | Create a bus on a route (one per route) |
| PATCH | `/api/admin/buses/:id` | Edit a bus / reassign its driver |

Writes are validated against the operator's school (cross-school → 403). The
**operator dashboard** is served at **`/admin.html`** (static, from `public/`):
operator OTP login, a live monitor polling `/admin/positions`, add a child with a
home pin, **arrange the pickup order** (times auto-computed), and add buses / edit
drivers.

## Pickup times & road data

`POST /admin/arrange` computes each child's pickup time by working **backward
from the school-arrival time** along the ordered home pins. Travel between homes
comes from **real road driving times** via **OSRM** (`src/domain/routing.ts`) —
keyless, like the Nominatim geocoder. If OSRM is unreachable (offline, blocked,
rate-limited) it **transparently falls back** to a straight-line distance
estimate, and the response's `mode` field reports which was used
(`"road"` | `"estimate"`).

Config (env):

| Var | Default | Purpose |
| --- | --- | --- |
| `OSRM_URL` | `https://router.project-osrm.org` | OSRM base URL. Set to your own OSRM instance for production; set empty to disable routing (always estimate). |
| `OSRM_TIMEOUT_MS` | `4000` | Per-request timeout before falling back. |

> The public OSRM demo server is rate-limited and not meant for production
> traffic — self-host OSRM (or point `OSRM_URL` at a routing provider you control)
> before real volume. The server host must also be allowed to reach it (egress).
> A copy-paste Docker + Lebanon-extract runbook is in
> [`docs/DEPLOY.md`](../docs/DEPLOY.md#road-routing--self-host-osrm-recommended-for-real-times).

## Auth

Phone-OTP → JWT (`@nestjs/jwt`, 30-day expiry, `JWT_SECRET` from env). OTP
delivery goes through an `SmsProvider` (`src/auth/sms/`): the default `console`
provider logs the code and returns it in the response for local testing; set
`SMS_PROVIDER=twilio` + `TWILIO_*` env to send real texts. Only the `console`
provider echoes the code back — with a real provider it's texted, not returned.

The **role is derived from the phone**: a parent phone → a `parent` token; a
bus's `driverPhone` → a `driver` token scoped to that bus's route; an operator's
phone → an `operator` token scoped to their school. Seed logins: parent
`+961 3 555 777`; Route A driver `+961 3 000 111`, Route B driver
`+961 3 000 222`; operators `+961 3 999 000` (Beirut IC) and `+961 3 999 111`
(Mount Lebanon). `/me/*` requires a parent token; `/admin/*` requires an operator.

## Push notifications

`NotificationsService` subscribes to the position stream and, for each child on a
route, fires "3 stops away" / "1 stop away" / "arriving" via the Expo Push API.
The `NotificationDecider` (unit-tested in `notify-decider.spec.ts`) sends each
threshold once per route-run and re-arms on the next run. Devices register an
Expo push token via `POST /me/push-token`.

To actually deliver: the server host must be allowed to reach `exp.host`
(egress), and the app must supply a real Expo push token (needs an EAS
`projectId` + a physical device). Tokens are stored in memory — add a
`PushToken` table for production.

Run the decider test: `npx ts-node src/notifications/notify-decider.spec.ts`

## Billing

Subscriptions activate **only** through a confirmed payment. `checkout` creates a
`pending` payment; `confirm` verifies it and then activates the subscription. A
`PaymentProvider` interface abstracts the gateway — the default
`MockPaymentProvider` confirms synchronously (no real money). To go live,
implement the interface for Stripe or a Lebanese gateway (e.g. Areeba) and route
its **webhook** into `BillingService.confirm`; bind it in `BillingModule`.
Payments persist via a repository (memory + Prisma `Payment`).

## Database (Prisma / Postgres)

Off by default (memory mode). To use Postgres:

```bash
docker compose up -d                 # local Postgres
# in .env: USE_PRISMA=true (DATABASE_URL already set)
npm run prisma:migrate               # create tables
npm run prisma:seed                  # load the Beirut demo data
npm run dev
```

The data source is chosen per repository by `USE_PRISMA`. Both `FleetRepository`
and `SubscriptionRepository` have memory + Prisma implementations; the Prisma
ones (and `@prisma/client`) are dynamically imported only when enabled, so
memory mode needs neither a database nor `prisma generate`.

## Socket.IO (authenticated)

Connect to the server root (no `/api` prefix). **Every connection must present a
JWT** in the handshake: `io(url, { auth: { token } })`. Connections without a
valid token are rejected (`unauthorized` event, then disconnect).

- **Parent:** `emit('subscribe', { routeId })` → receives `position`
  (`BusPosition`) events. Allowed **only for routes the parent's own children
  ride**; other routes are refused. `emit('unsubscribe', { routeId })` to stop.
- **Driver:** `emit('driver:gps', { routeId, location, speedKmh? })` — accepted
  **only for the driver's assigned route** (from the token). Parents can't send
  gps; drivers can't subscribe.

Handlers ack `{ ok: boolean }`, so a denied action is observable client-side.

## How positions work

`PositionsService` holds one `BusPosition` per route.

- **Driver priority:** an incoming `driver:gps` is snapped onto the route
  polyline (`projectOntoRoute`) to derive `currentStopIndex` + `progressToNext`,
  tagged `source: 'driver'`, and broadcast. Points >1.5 km off-route are dropped.
- **Simulator fallback:** any route without a live driver (none seen for 10 s) is
  advanced by the built-in simulator and tagged `source: 'simulator'`, so the
  demo always has moving buses. Handover in both directions is automatic.

## Architecture notes

- Fleet data is loaded once at startup (memory or Postgres) and cached, so hot
  paths (the positions tick) stay synchronous and never wait on the DB.
- Both REST and the socket are authenticated. Positions are read **only** over
  the authorized socket — there is no public positions REST endpoint.
- `src/domain/{types,geo}.ts` mirror the app's copies; extract a shared package
  when versioning the two together.

## Modules

```
src/
  domain/        types, geo (Haversine + route projection), phone util, seed data
  auth/          phone-OTP, JWT, JwtAuthGuard, @CurrentUser
  fleet/         routes / buses (REST) + cached read service + repositories
  admin/         guarded operator dashboard API (overview, live positions, writes)
  billing/       payment provider abstraction, checkout/confirm, Payment repo
  me/            guarded parent data (children, subscription)
  notifications/ push decider (tested), Expo push client, token store, /me/push-token
  positions/     PositionsService (state + sim), Socket.IO gateway, REST controller
  subscriptions/ plans, entitlement, activation + repositories
  prisma/        lazy PrismaClient (loaded only when USE_PRISMA=true)
  app.module.ts  main.ts
prisma/          schema.prisma, seed.ts
```
