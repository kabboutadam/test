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

### Phase 3 — Accounts, auth, notifications
- Auth: phone-number OTP (widely usable in Lebanon) via the auth provider.
- Push notifications with `expo-notifications`: configurable triggers
  ("notify me at 2 stops away", "arriving", "missed pickup").
- Link parents ↔ children ↔ stops during onboarding; support multiple schools.

### Phase 4 — Billing + operator dashboard
- **Billing:** evaluate options given Lebanon's payment landscape — Apple/Google
  in-app purchase (simplest cross-border), a regional gateway (e.g. Areeba /
  local bank gateways), or school-collected fees with app-side entitlement.
  `services/subscription.ts#entitles()` is the single check to back with a
  verified receipt.
- **Operator/admin web dashboard:** manage routes/stops/buses, assign drivers
  and children, monitor all live buses, handle subscriptions.

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
