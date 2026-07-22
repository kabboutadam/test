# BusMapp 🚌

A mobile app for parents in Lebanon to track their children's school bus in real
time and see exactly **how many stops away** the bus is. Access is gated behind a
paid subscription.

> **Status:** Working scaffold. Bus movement is **simulated** so the full parent
> experience runs end-to-end today. Real GPS and a backend are the next phase —
> see [`docs/PLAN.md`](docs/PLAN.md).

## What works right now

- **Home / My Children** — every child with a live status chip (`3 stops away`,
  `~7 min`, `Arriving`, `Picked up`).
- **Live tracking screen** — a big "stops away" countdown, bus/driver details,
  and a **Map / Stops toggle**: a real geographic map (route polyline, stop
  markers, live bus marker) or a dependency-free route schematic, both driven by
  the same `BusPosition`.
- **Subscription gate** — tracking unlocks only for `trial`/`active`
  subscriptions; a paywall with monthly/yearly plans (mock purchase).
- **Bus simulator** — two Beirut routes (Achrafieh & Hamra) whose buses advance
  through their stops on a timer, emitting the same `BusPosition` shape real GPS
  will use.

## Tech stack

- **Expo (React Native)** + **expo-router** (file-based navigation), TypeScript.
- **react-native-maps** for the geographic view (Apple Maps on iOS, Google Maps
  on Android). The pure-RN route schematic remains as the low-data / offline
  fallback — relevant for Lebanese networks.

### Map requirements

- **iOS:** uses Apple Maps — works with no API key.
- **Android:** Google Maps needs an API key. Put it in
  `app.json → android.config.googleMaps.apiKey` (currently a placeholder) and
  build a **dev client** (`npx expo prebuild && npx expo run:android`, or an EAS
  build). Without it, tap **Stops** to use the schematic.
- The **Stops** view always works everywhere, including Expo Go.

## Run it

```bash
npm install
npx expo start
```

Then press `i` (iOS simulator), `a` (Android emulator), or scan the QR code with
the **Expo Go** app on your phone. If dependency versions drift, run
`npx expo install --fix`.

Demo tips:
- Both buses start moving the moment the app launches.
- Open a child to watch the "stops away" number tick down.
- **Account → Restart bus simulation** sends the buses back to the start.

## Project layout

```
app/                      # Screens (expo-router)
  _layout.tsx             #   root stack + providers + auth gate
  login.tsx               #   phone/OTP login (backend mode)
  (tabs)/index.tsx        #   home: list of children
  (tabs)/account.tsx      #   profile, subscription, demo controls
  track/[childId].tsx     #   live tracking detail
  driver/index.tsx        #   driver mode: stream GPS to backend
  paywall.tsx             #   subscription plans
src/
  models/types.ts         # domain model (transport-agnostic)
  data/mockData.ts        # Beirut routes, buses, family, subscription seed
  api/                    # config, REST client, auth, position source, driver client
  services/
    busSimulator.ts       # local position source (simulator mode)
    stopsAway.ts          # BusPosition -> "N stops away" + ETA
    subscription.ts       # entitlement + mock plans
    geo.ts                # lat/lng helpers
  store/AppContext.tsx    # global state; simulator or live backend
  store/AuthContext.tsx   # JWT + phone-OTP flow (secure storage)
  components/             # ChildCard, StopsAwayBadge, RouteProgress, BusMap
  theme/theme.ts          # colors, spacing, radii
server/                   # NestJS API (see server/README.md)
docs/PLAN.md              # architecture & phased roadmap
```

## Backend + driver + auth (Phase 2–3)

There is a real NestJS API in [`server/`](server/), a **driver mode** in the app,
**phone-OTP login**, and an optional **Postgres** database — so live positions
can come from an actual driver and each parent sees only their own children.

```
Driver app  ──emit driver:gps──▶  NestJS server  ──snap to route──▶  Socket.IO
(expo-location)                   (PositionsService)                 room per route
                                                                        │
                                          Parent app  ◀──position events─┘
```

- **Server:** REST for routes/plans, **phone-OTP auth** (JWT), guarded `/me/*`
  parent data, live `BusPosition` over Socket.IO, and **push notifications**
  ("3 stops away" / "1 stop" / "arriving" via the Expo Push API). Raw driver GPS
  is snapped onto the route polyline to compute "stops away". Routes with no live
  driver are advanced by a server-side simulator. Data is in-memory by default or
  **Postgres via Prisma** (`USE_PRISMA=true`). See [`server/README.md`](server/README.md).
- **Notifications:** Account → **Bus approach alerts**. In simulator mode the app
  fires the alerts locally from the position stream (works in Expo Go). In
  backend mode the server sends push (works with the app closed) — which needs an
  EAS `projectId` in `app.json` and the server allowed to reach `exp.host`.
- **Driver mode:** Account → **Driver mode**. The driver signs in with their own
  phone (e.g. **+961 3 000 111** for Route A) and can stream only their assigned
  route — "Simulate route" (synthetic GPS, great for demos) or "Device GPS".
- **Secured realtime:** the Socket.IO channel is authenticated — parents see only
  their own children's routes and drivers can only report their own bus, so
  nobody can track arbitrary children or spoof a bus.
- **Onboarding & multi-school:** two schools (Beirut & Mount Lebanon) with their
  own routes. Parents add a child via a school → route → stop flow
  (`POST /me/children`, or a local add in simulator mode).
- **Operator dashboard:** a web dashboard at **`/admin.html`** (served by the API)
  where a school operator signs in, monitors all their buses live (status,
  current→next stop, progress, child counts), and manages the fleet — add routes,
  add buses, reassign drivers. Scoped to their school only.
- **Billing:** subscriptions activate only through a confirmed payment
  (checkout → confirm), behind a `PaymentProvider` interface — a mock provider by
  default, swappable for Stripe or a Lebanese gateway.

**Validating on a real device:** follow [`docs/SMOKE_TEST.md`](docs/SMOKE_TEST.md)
— a step-by-step checklist for both simulator and backend modes.
- **Parent app source:** controlled by `app.json → expo.extra.useBackend`.
  `false` (default) uses the built-in simulator and mock data so the app runs
  standalone with no login. `true` connects to the server: the app shows a
  **phone/OTP login**, then loads the signed-in parent's children and
  subscription live. Set `apiBaseUrl` to your machine's LAN IP on a phone.

### Run the full stack

```bash
# 1) backend (in-memory, no DB)
cd server && npm install && cp .env.example .env && npm run dev

# 2) app — set expo.extra.useBackend = true (and apiBaseUrl) in app.json, then
npx expo start
```

Log in with the seed parent's phone **+961 3 555 777** — in dev the server
returns the OTP and the login screen prefills it. Postgres is optional; see
[`server/README.md`](server/README.md) for the docker-compose + Prisma steps.

## The one seam that matters

Everything the UI shows flows from a single object, `BusPosition`. It is produced
by either the local `BusSimulator` or the backend (`BackendPositionSource` over
Socket.IO), selected by one config flag. On the server, a driver's raw GPS and
the fallback simulator both emit that same object — so no screen or component
changes as real telemetry replaces simulation.
