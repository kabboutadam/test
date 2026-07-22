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

## REST

Public:

| Method | Path | Purpose |
| --- | --- | --- |
| GET  | `/api/schools` | All schools |
| GET  | `/api/schools/:id/routes` | Routes at a school (onboarding) |
| GET  | `/api/routes` | All routes with stops |
| GET  | `/api/routes/:id` | One route |
| GET  | `/api/buses` | All buses |
| GET  | `/api/positions` | Snapshot of every bus position |
| GET  | `/api/positions/:routeId` | One bus's position |
| POST | `/api/positions/:routeId/gps` | Driver GPS ingest (REST fallback) |
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
| POST | `/api/me/subscription` | Activate a plan (mock) |
| POST | `/api/me/push-token` | Register this device's Expo push token |
| DELETE | `/api/me/push-token` | Unregister a push token |

Operator — require an **operator** token, scoped to the operator's school:

| Method | Path | Purpose |
| --- | --- | --- |
| GET  | `/api/admin/overview` | School, routes (bus/driver/child counts), totals |
| GET  | `/api/admin/positions` | Live status per route in the school |
| POST | `/api/admin/routes` | Create a route (name + stops); starts tracking |
| POST | `/api/admin/buses` | Create a bus on a route (one per route) |
| PATCH | `/api/admin/buses/:id` | Edit a bus / reassign its driver |

Writes are validated against the operator's school (cross-school → 403). The
**operator dashboard** is served at **`/admin.html`** (static, from `public/`):
operator OTP login, a live monitor polling `/admin/positions`, and forms to add
routes/buses and edit drivers.

## Auth

Phone-OTP → JWT (`@nestjs/jwt`, 30-day expiry, `JWT_SECRET` from env). There is
no SMS provider yet, so the code is logged and, when `NODE_ENV !== 'production'`,
returned in the response for testing. Replace `AuthService.deliverOtp` with a
real SMS gateway.

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
  admin/         guarded operator dashboard API (overview, live positions)
  me/            guarded parent data (children, subscription)
  notifications/ push decider (tested), Expo push client, token store, /me/push-token
  positions/     PositionsService (state + sim), Socket.IO gateway, REST controller
  subscriptions/ plans, entitlement, activation + repositories
  prisma/        lazy PrismaClient (loaded only when USE_PRISMA=true)
  app.module.ts  main.ts
prisma/          schema.prisma, seed.ts
```
