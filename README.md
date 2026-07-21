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
  and a route schematic showing the bus moving between stops in real time.
- **Subscription gate** — tracking unlocks only for `trial`/`active`
  subscriptions; a paywall with monthly/yearly plans (mock purchase).
- **Bus simulator** — two Beirut routes (Achrafieh & Hamra) whose buses advance
  through their stops on a timer, emitting the same `BusPosition` shape real GPS
  will use.

## Tech stack

- **Expo (React Native)** + **expo-router** (file-based navigation), TypeScript.
- No native map dependency yet — the route view is a pure-RN schematic so it runs
  in **Expo Go** with zero extra setup. A geographic map is a planned enhancement.

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
  _layout.tsx             #   root stack + providers
  (tabs)/index.tsx        #   home: list of children
  (tabs)/account.tsx      #   profile, subscription, demo controls
  track/[childId].tsx     #   live tracking detail
  paywall.tsx             #   subscription plans
src/
  models/types.ts         # domain model (transport-agnostic)
  data/mockData.ts        # Beirut routes, buses, family, subscription seed
  services/
    busSimulator.ts       # the ONLY source of fake positions
    stopsAway.ts          # BusPosition -> "N stops away" + ETA
    subscription.ts       # entitlement + mock plans
    geo.ts                # lat/lng helpers
  store/AppContext.tsx    # global state; wires simulator -> React
  components/             # ChildCard, StopsAwayBadge, RouteProgress
  theme/theme.ts          # colors, spacing, radii
docs/PLAN.md              # architecture & phased roadmap
```

## The one seam that matters

Everything the UI shows flows from a single object, `BusPosition`. Today it is
produced by `BusSimulator`. To go live, replace that one class with a real
telemetry source (driver-phone GPS or hardware tracker) that emits the same
object — no screen or component needs to change.
