# BusMapp — Architecture & Roadmap

This document is the plan behind the scaffold in this repo. It explains the
design decisions, then lays out the phases from today's simulated demo to a
production app running on real Lebanese school routes.

---

## 1. Product in one paragraph

Parents subscribe to BusMapp. Each parent has one or more children, each assigned
to a bus route with a specific stop. During the ride, the parent opens the app
and sees their child's bus moving in real time, with a prominent **"N stops
away"** countdown and an ETA to their stop. As the bus approaches, the parent
gets push notifications ("2 stops away", "arriving now"). Access to live tracking
requires an active subscription.

## 2. Roles

| Role | Uses | Needs |
| --- | --- | --- |
| **Parent** | The app in this repo | See their child's bus, stops-away, ETA, notifications |
| **Driver** | A separate lightweight app (Phase 2) | Start/stop a route; broadcast GPS |
| **School / operator admin** | A web dashboard (Phase 4) | Manage routes, stops, buses, driver & child assignments, subscriptions |

## 3. Core design decision: the `BusPosition` seam

The entire UI consumes one object — `BusPosition` (`src/models/types.ts`):

```ts
{ busId, routeId, status, location, currentStopIndex, progressToNext, speedKmh, updatedAt }
```

Today `BusSimulator` fabricates it. In production a telemetry source emits the
same object. Because the "stops away" math (`services/stopsAway.ts`) and every
screen read only from `BusPosition`, swapping the source is a localized change.

**`stopsAway` formula:** with `progressIndex = currentStopIndex + progressToNext`
and the child at stop index `C`, then `stopsAway = ceil(C - progressIndex)`.
`0` means arriving, negative means already picked up. ETA sums the nominal
per-segment travel minutes from the schedule, scaled by progress into the current
segment.

## 4. Phased roadmap

### Phase 0 — Simulated demo ✅ (this repo)
- Expo app, parent flows, subscription gate, two Beirut routes, simulator.
- Route rendered as a schematic (no native map dependency; runs in Expo Go).

### Phase 1 — Real map ✅ (this repo)
- **react-native-maps** tracking view alongside the schematic, via a Map/Stops
  toggle: bus marker + stop markers + route polyline, all driven by the same
  `BusPosition`. iOS uses Apple Maps (no key); Android needs a Google Maps key in
  `app.json` and a dev build. Schematic remains the offline/low-data fallback.

### Phase 1b — Map polish
- ✅ Follow-the-bus camera (with "Whole route" fit and auto-release on pan).
- ✅ Smooth marker tweening between position updates (AnimatedRegion).
- ⬜ Real road-following route polylines instead of straight segments between
  stops (Directions API or offline routing).

### Phase 2 — Backend + real GPS ✅ (this repo)
- **Backend (`server/`):** a NestJS API owning routes/buses/children/parents/
  subscriptions (in-memory, seeded from the same Beirut data; swap for
  Postgres/Prisma behind the same service methods).
- **Realtime:** a Socket.IO gateway. Parents `subscribe {routeId}` and receive
  `position` events; the `PositionsService` fans updates to each route's room.
- **Driver ingest:** drivers emit `driver:gps {routeId, location, speedKmh}`
  (socket) or `POST /positions/:routeId/gps` (REST). The server **snaps** the raw
  point onto the route polyline (`projectOntoRoute`) to derive
  `currentStopIndex` + `progressToNext` — the real "stops away" math. Readings
  >1.5 km off-route are rejected.
- **Simulator fallback:** routes without a live driver are advanced by a
  server-side simulator, so there are always moving buses. A driver stream takes
  over automatically and hands back when it goes stale (10 s).
- **Driver app:** driver mode in the Expo app (`app/driver/`) with a route
  picker and two sources — "Simulate route" (synthetic GPS for demos) and
  "Device GPS" (`expo-location`).
- **Parent app seam:** `PositionSource` abstraction — `BackendPositionSource`
  (Socket.IO) or the local `BusSimulator`, chosen by `expo.extra.useBackend`.
  The UI is identical either way.
- **Verified:** an end-to-end socket test confirmed a driver GPS point is
  snapped onto the route and rebroadcast to a subscribed parent.

**Still open in this phase:** real auth (endpoints currently trust a `parentId`
/ `routeId`), a Postgres-backed data layer, and background-location streaming for
when the driver's phone is locked.

### Phase 3 — Accounts, auth, Postgres ✅ (this repo)
- **Phone-OTP auth:** `POST /auth/otp/request` → `POST /auth/otp/verify` issues a
  JWT (`@nestjs/jwt`, 30-day expiry). No SMS provider yet — the code is logged
  and, outside production, returned in the response for testing. Swap
  `AuthService.deliverOtp` for a real SMS gateway.
- **Guarded parent data:** `JwtAuthGuard` + `@CurrentUser`; children and
  subscription are served from `/me/*` and derived from the token, not a
  client-supplied id.
- **Postgres via Prisma:** full schema (`server/prisma/schema.prisma`), a
  repository abstraction with memory + Prisma implementations selected by
  `USE_PRISMA`, a seed script, and docker-compose. Memory stays the zero-infra
  default so the demo runs with no database; the fleet is cached in memory at
  startup either way so the positions tick never waits on the DB.
- **App:** phone/OTP login screen (backend mode only), secure token storage
  (`expo-secure-store`), and the parent home/account now load children +
  subscription from the live API; the paywall activates via `POST /me/subscription`.

### Phase 3b — Notifications ✅ (this repo)
- **Server push:** `NotificationsService` subscribes to the position stream and,
  per child on each route, fires "3 stops away" / "1 stop away" / "arriving" via
  the Expo Push API. A `NotificationDecider` sends each threshold once per
  route-run (re-arming on the next run) — unit-tested in
  `notify-decider.spec.ts`. Devices register an Expo push token at
  `POST /me/push-token` (guarded). Because the trigger lives on the server, push
  works with the app closed.
- **App:** simulator mode fires the same thresholds as **local** notifications
  from the position stream (works in Expo Go, no server/EAS); backend mode
  registers the device token and relies on server push (local firing disabled to
  avoid duplicates). Toggle under Account → Notifications.
- **Two real-world requirements** (documented, not needed for the local demo):
  1. Remote Expo push tokens need an **EAS `projectId`** in
     `app.json → expo.extra.eas.projectId` (and a physical device).
  2. The server host must be allowed to reach **`exp.host`** (egress) to deliver.
- **Still open:** "missed pickup"/geofence alerts, per-parent threshold
  preferences, and persisting push tokens (a `PushToken` table) instead of the
  in-memory store.

### Phase 3d — Secure the realtime channel ✅ (this repo)
- **Roles:** the JWT now carries a role — `parent` or `driver` (derived from the
  phone: a bus's `driverPhone` → a driver token scoped to that route).
- **Authenticated sockets:** every Socket.IO connection must present a valid JWT
  in the handshake or it's rejected. Parents may subscribe **only** to routes
  their own children ride; drivers may send `driver:gps` **only** for their
  assigned route; roles can't cross. The public positions REST endpoint was
  removed — positions flow only over the authorized socket.
- **App:** the parent app sends its token in the socket handshake; the driver
  screen signs in as a driver (OTP) and streams only its assigned route.
- **Verified** with a socket harness: no-token rejected; parent confined to owned
  routes; driver confined to its route; cross-role actions denied.
- **Still open:** rate-limiting/abuse controls on `driver:gps`, and rotating the
  `JWT_SECRET` / short-lived tokens with refresh.

### Phase 3c — Onboarding & multi-school ✅ (this repo)
- **Multi-school:** the data model already had `School`/`Route.schoolId`; added a
  second school (Mount Lebanon School) with its own route, `GET /schools` and
  `GET /schools/:id/routes`, and `FleetService.getSchools/getRoutesForSchool`.
- **Add-child onboarding:** guarded `POST /me/children` (validates the stop
  belongs to the route) writes through the repository (`FleetRepository.addChild`
  — memory + Prisma) and updates the cache. The app has an add-child flow
  (school → route → stop → name/grade), reached from Account or the Home
  empty-state; `AppContext.addChild` posts in backend mode or appends locally in
  simulator mode.
- **Still open:** editing/removing a child, parent self-signup (today a phone
  must already exist as a parent), and school-scoped driver/operator roles.

### Phase 4a — Operator dashboard ✅ (this repo)
- **Operator role:** a phone that matches an `Operator` → an operator token
  scoped to that operator's school. Guarded `/admin/*` reject non-operators.
- **Admin API (read):** `GET /admin/overview` (school, routes with bus/driver/
  child counts, totals) and `GET /admin/positions` (live status per route), both
  **scoped to the operator's school** — an operator never sees another school's
  fleet.
- **Admin API (write):** `POST /admin/routes` (name + stops; the new route starts
  tracking immediately via `PositionsService.registerRoute`), `POST /admin/buses`
  (one per route), `PATCH /admin/buses/:id` (edit/reassign driver — the driver
  phone becomes that driver's login). All validated against the operator's school
  (cross-school → 403, duplicate bus → 400). Repository writes are memory + Prisma.
- **Dashboard:** a self-contained page served by the API at `/admin.html`
  (`server/public/`) — operator OTP login, a live monitor polling
  `/admin/positions` every 2s, plus **Add route / Add bus / edit driver** forms.
  No separate build toolchain.
- **Verified:** curl (read + write, school-scoping, parent → 403, cross-school →
  403, duplicate → 400) and **headless-browser smoke tests** — login + live table,
  and add-route + add-bus + edit-driver reflected live.
- **Still open:** editing/removing stops & routes, assigning children from the
  dashboard, and a map view.

### Phase 4b — Billing ✅ (this repo)
- **Payment-gated subscriptions:** a subscription activates **only** through a
  confirmed payment. `POST /me/billing/checkout` creates a *pending* `Payment`;
  `POST /me/billing/confirm` verifies it and then activates the subscription
  server-side. The direct activate endpoint was removed, so the client can no
  longer self-grant access.
- **Provider abstraction:** a `PaymentProvider` interface with a default
  `MockPaymentProvider` (confirms synchronously, no real money). To go live,
  implement the interface for Stripe or a Lebanese gateway (e.g. Areeba) and
  route its **webhook** into `BillingService.confirm` — nothing else changes.
- **Payments persisted** via a repository (memory + Prisma `Payment` model).
  Confirm is idempotent; cross-parent/bogus payments are rejected.
- **App:** the paywall runs checkout → confirm with a processing state.
- **Verified:** curl (trial → checkout stays trial → confirm activates; idempotent
  re-confirm; old activate endpoint 404; bogus payment 404) and app typecheck.
- **Still open:** the real provider decision + webhook signing, recurring renewal
  / expiry handling, receipts, and refunds.

### Phase 4b-note — choosing a provider for Lebanon
Evaluate given the payment landscape: Apple/Google in-app purchase (simplest
cross-border), a regional gateway (e.g. Areeba / local bank gateways), or
school-collected fees with app-side entitlement. `SubscriptionsService.entitles()`
(server) / `services/subscription.ts#entitles()` (app) remains the single gate.

### Distribution — TestFlight ready ✅ (this repo)
- App icon + splash/adaptive/favicon assets, iOS `bundleIdentifier`/`buildNumber`,
  export-compliance flag, and `eas.json` build/submit profiles are configured.
- First build ships in self-contained **simulator mode** so testers need no
  backend. Runbook: `docs/TESTFLIGHT.md`. The build/submit run on the user's
  machine (interactive Apple auth) — not automatable from the cloud sandbox.
- **Before wider release:** an Apple Developer account, `eas init` to mint the
  `projectId`, a real SMS provider (for backend-mode login), and a deployed
  server if shipping backend mode.

### Phase 5 — Reliability & scale
- Offline handling, GPS gap smoothing, driver "route ended" detection.
- ETA model improvements (traffic, historical segment times).
- Multi-school tenancy, Arabic localization (RTL), afternoon/drop-off routes.

## 5. Data model (already scaffolded)

See `src/models/types.ts`. Entities: `School`, `Route`, `Stop`, `Bus`, `Child`,
`Parent`, `Subscription`, and the live `BusPosition`. `src/data/mockData.ts`
seeds a Beirut demo (two routes, one family with two children); replace it with
API calls in Phase 2 without touching the UI.

## 6. Open questions to decide before Phase 2

1. **GPS source** — driver phone (cheapest to launch) vs. hardware trackers
   (more reliable). The scaffold assumes driver-phone; hardware just becomes a
   different producer of `BusPosition`.
2. **Payments** — which provider clears reliably for Lebanese parents?
3. **Who onboards routes/stops** — schools, a central operator, or self-serve?
4. **Afternoon routes** — drop-off is the reverse problem; model now or later?
5. **Privacy** — children's location is sensitive; define retention and who can
   see which child.
