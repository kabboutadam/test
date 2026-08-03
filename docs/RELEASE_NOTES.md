# Release notes

## Unreleased — background driver tracking

- **The bus keeps sharing its location with the app in the background.** Driver
  mode's "Device GPS" now uses an OS background-location task, so tracking
  continues while the phone is locked or mounted on the dash — the driver taps
  **Start route** once and can pocket/mount the phone. Tap **Stop** (or sign out)
  to end it. An Android foreground-service notification shows while it's active.
- New HTTP ingest endpoint `POST /api/driver/positions` (driver token, route-
  scoped) that the background task posts to; same authorization and pipeline as
  the live `driver:gps` socket. 31/31 isolation checks (added driver-ingest
  auth: own route OK, other route 403, parent 403).
- **Requires a new native build** (adds background-location permission + iOS
  `location` background mode) — this one can't ship as an OTA update.

## Unreleased — simpler school setup

- **No more route-building for schools.** A school now just adds each child with
  their **home address/pin** and the **parent's phone** — no route to pick.
- **Arrange by order, times are automatic.** The school orders the kids (▲▼) and
  sets a **"be at school by"** time; the app computes **each child's pickup time**
  from **real road driving times** between homes (OSRM), working backward from
  arrival — with a distance-estimate fallback if routing is unavailable, and it
  tells you which was used. Parents see the pickup time on their child's card.
- **Multiple buses.** A school can run several buses — each its own pickup list
  with its own order, arrival time, and computed times. Add a bus, choose which
  bus a child rides, and move kids between buses.
- Same flow in the **app** (per-bus *Arrange* + *Add bus* screens) and the
  **web dashboard** (kids grouped by bus). Endpoints: `POST /admin/arrange` and
  add/move-child take an optional `routeId`; `POST /admin/children` no longer
  needs one. Super-admin school access/subscription controls are unchanged.

## 0.3.0 — live backend

**This is the first build that talks to the real server** (not the built-in
demo). `app.json` now has `useBackend: true` +
`apiBaseUrl: https://busmapp-api.onrender.com`.

- Phone-OTP login is required; each role is routed to its place — parents to
  their kids, schools to the School area, drivers to Driver mode.
- The app now loads **routes from the server** (not the demo seed), so real
  schools/routes/kids created on the platform work end to end.
- Driver mode fetches the driver's assigned route from the server and streams
  GPS (or simulated GPS) for it.

> Requires the server to be reachable. On the free Render tier the first request
> after idle takes ~30–60s to wake — move to a paid always-on plan before real
> families rely on it.

## 0.2.0 (build 10)

**New**
- **Arabic + right-to-left.** The whole parent app is translated to Arabic, with
  a proper RTL layout. Switch anytime in Account → Language (English / العربية).
- **Afternoon drop-off tracking.** A Morning / Afternoon toggle on the Home
  screen. Afternoon follows the school → home run and drops each child at the
  same neighborhood they boarded from, with "dropping off" wording. It defaults
  to whichever matches the current time of day.

**Under the hood**
- Backend now serves the afternoon drop-off routes too, so live tracking works
  in both directions once the server is deployed.
- Over-the-air updates (EAS Update) are enabled from this build on, so future
  text/logic fixes can reach testers without a new TestFlight build.

### TestFlight "What to Test" (paste into App Store Connect)

> This build adds Arabic (with right-to-left layout) and afternoon drop-off
> tracking. Please try: Account → Language → العربية to switch to Arabic, and the
> Morning / Afternoon toggle at the top of the Home screen. Confirm the bus still
> counts down "stops away" in both directions and that Arabic reads correctly
> right-to-left. Note anything that looks mislaid out or untranslated.

---

## 0.1.0 (builds 1–9)

First TestFlight builds. Demo mode: simulated Beirut bus routes, "stops away"
tracking, live map, approach notifications, add/edit children, and a simulated
subscription flow.
