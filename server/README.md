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
| GET  | `/api/me/subscription` | Current subscription |
| POST | `/api/me/subscription` | Activate a plan (mock) |
| POST | `/api/me/push-token` | Register this device's Expo push token |
| DELETE | `/api/me/push-token` | Unregister a push token |

## Auth

Phone-OTP → JWT (`@nestjs/jwt`, 30-day expiry, `JWT_SECRET` from env). There is
no SMS provider yet, so the code is logged and, when `NODE_ENV !== 'production'`,
returned in the response for testing. Replace `AuthService.deliverOtp` with a
real SMS gateway. Parents are matched by phone (normalized), so the seed parent
`+961 3 555 777` can log in.

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

## Socket.IO

Connect to the server root (no `/api` prefix).

- **Parent:** `emit('subscribe', { routeId })` → then receives `position`
  (`BusPosition`) events. `emit('unsubscribe', { routeId })` to stop.
- **Driver:** `emit('driver:gps', { routeId, location, speedKmh? })`.

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
- **Socket auth is still open** — the `driver:gps` event and route subscriptions
  aren't authenticated yet. Add token checks on the gateway and per-driver route
  authorization before production. REST parent data is already guarded.
- `src/domain/{types,geo}.ts` mirror the app's copies; extract a shared package
  when versioning the two together.

## Modules

```
src/
  domain/        types, geo (Haversine + route projection), phone util, seed data
  auth/          phone-OTP, JWT, JwtAuthGuard, @CurrentUser
  fleet/         routes / buses (REST) + cached read service + repositories
  me/            guarded parent data (children, subscription)
  notifications/ push decider (tested), Expo push client, token store, /me/push-token
  positions/     PositionsService (state + sim), Socket.IO gateway, REST controller
  subscriptions/ plans, entitlement, activation + repositories
  prisma/        lazy PrismaClient (loaded only when USE_PRISMA=true)
  app.module.ts  main.ts
prisma/          schema.prisma, seed.ts
```
