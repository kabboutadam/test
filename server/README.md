# BusMapp API (NestJS)

Fleet data, live bus positions, and subscriptions for the BusMapp mobile app.

## Run

```bash
npm install
npm run dev      # ts-node, http://localhost:3000/api
# or
npm run build && npm start
```

## REST

| Method | Path | Purpose |
| --- | --- | --- |
| GET  | `/api/routes` | All routes with stops |
| GET  | `/api/routes/:id` | One route |
| GET  | `/api/buses` | All buses |
| GET  | `/api/children?parentId=` | A parent's children |
| GET  | `/api/positions` | Snapshot of every bus position |
| GET  | `/api/positions/:routeId` | One bus's position |
| POST | `/api/positions/:routeId/gps` | Driver GPS ingest (REST fallback) |
| GET  | `/api/plans` | Subscription plans |
| GET  | `/api/subscriptions/:parentId` | Current subscription |
| POST | `/api/subscriptions/:parentId` | Activate a plan (mock) |

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

- Data is **in-memory**, seeded from `src/domain/seed.ts` (same ids as the app).
  Replace the service internals with a Postgres repository (Prisma/TypeORM)
  without touching controllers or the gateway.
- **No auth yet** — `parentId` and `routeId` are trusted from the request. Add
  phone-OTP auth and per-driver route authorization before production.
- `src/domain/{types,geo}.ts` mirror the app's copies; extract a shared package
  when versioning the two together.

## Modules

```
src/
  domain/        types, geo (Haversine + route projection), seed data
  fleet/         routes / buses / children (REST + read service)
  positions/     PositionsService (state + sim), Socket.IO gateway, REST controller
  subscriptions/ plans, entitlement, mock activation
  app.module.ts  main.ts
```
