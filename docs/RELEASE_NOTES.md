# Release notes

## 0.3.1 — simpler school setup, multiple buses, background driver tracking

**Schools set up pickups by adding kids, not building routes.**
- **Add a child** with their **home pin** + **parent's phone** — no route to
  pick. **Arrange** the kids in pickup order and set a **"be at school by"** time;
  the app computes **each child's pickup time** from **real road driving times**
  (OSRM), working backward from arrival. Falls back to a distance estimate if
  routing is unavailable, and tells you which was used.
- **Multiple buses** — a school can run several, each its own list with its own
  order, arrival time, and times. Add a bus, pick which bus a child rides, move
  kids between buses. Same flow in the **app** and the **web dashboard**.

**Drivers are tracked in the background.**
- Driver mode's **Device GPS** now keeps sharing the bus's location with the app
  **locked or backgrounded** — the driver taps **Start route** once and mounts
  the phone; **Stop** (or sign out) ends it. Android shows a "sharing location"
  notification while active; iOS asks for **Always Allow** to keep running locked.
- Driver mode shows the **pickup list in order** — each kid's name, home address,
  and time, with a one-tap **call parent** button if a child isn't at the stop.

**Under the hood.** New endpoints — `POST /admin/arrange`, optional `routeId` on
add/move-child, and `POST /api/driver/positions` (the background task's ingest,
same auth as the `driver:gps` socket). 31/31 tenant-isolation checks. Super-admin
school access/subscription controls unchanged.

> **This build carries native changes** (background-location permission + iOS
> `location` background mode), so it's a fresh build, not an OTA update. After
> it's installed, JS-only tweaks can ship over-the-air again with `eas update`.

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
