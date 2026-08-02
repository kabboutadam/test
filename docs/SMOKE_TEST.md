# BusMapp — device validation checklist

Everything so far is validated by typechecks, builds, and targeted socket/HTTP/
unit harnesses — but never run as a real app. This is the checklist to close that
gap on an actual phone. Work top to bottom; each box is a thing to *see*, not
just assume.

## 0. Prerequisites

- [ ] Node 18+ and npm.
- [ ] The **Expo Go** app on your phone (iOS or Android), phone on the **same
      Wi-Fi** as your computer.
- [ ] `npm install` at the repo root completes.
- [ ] `npm run typecheck` (root) passes; `npm run --prefix server build` passes.

---

## 1. Simulator mode (no backend, no login)

This is the default (`app.json → expo.extra.useBackend = false`).

- [ ] `npx expo start`, scan the QR with Expo Go — the app opens on **My Children**.
- [ ] Two children (Maya, Karim) are listed, each with a moving status chip
      (e.g. `3 stops away · ~7 min`).
- [ ] Tap a child → tracking screen. The big **stops-away** number counts down.
- [ ] Toggle **Map / Stops**:
  - [ ] **Map** shows the route line, stops, and the bus marker moving; the bus
        marker glides (doesn't jump); **Follow bus** / **Whole route** work.
        _(On Android the map needs a Google Maps key + dev build — see README; if
        it's blank in Expo Go, that's expected, use Stops.)_
  - [ ] **Stops** shows the schematic with the bus advancing between stops.
- [ ] Driver/bus card shows plate + driver.
- [ ] Account → **Bus approach alerts** is ON; grant the notification permission
      when prompted.
- [ ] Watch a child approach: you get local notifications at **3 stops**, **1
      stop**, and **arriving** (once each). Toggle the setting off → no more.
- [ ] Account → **Restart bus simulation** → both buses jump back to the start.

---

## 2. Backend mode (live server + login)

### 2a. Start the server
- [ ] `cd server && npm install && cp .env.example .env && npm run dev`
- [ ] Log shows `BusMapp API listening…` and `Tracking N routes`.
- [ ] Find your computer's LAN IP (e.g. `192.168.1.20`).

### 2b. Point the app at it
- [ ] In `app.json` set `expo.extra.useBackend = true` and
      `expo.extra.apiBaseUrl = "http://<LAN-IP>:3000"`.
- [ ] Restart `npx expo start` (clear cache: `npx expo start -c`).

### 2c. Parent login
- [ ] App opens on the **login** screen.
- [ ] Phone is prefilled `+961 3 555 777`. Tap **Send code** → the code
      auto-fills (dev convenience) → **Verify**.
- [ ] You land on **My Children** with Maya + Karim loaded **from the server**.
- [ ] Account shows the subscription status from the server (trial).

### 2d. Live tracking from the server
- [ ] Open a child — the position updates every second, driven by the server's
      simulator (no driver connected yet).

### 2e. Driver streaming (the real end-to-end loop)
- [ ] Account → **Driver mode**.
- [ ] Sign in as a driver: phone `+961 3 000 111` (Route A) → **Send code** →
      **Verify**. You see **Route A** as your assigned route.
- [ ] Source = **Simulate route**, tap **Start route**. "Points sent" climbs.
- [ ] Back in the parent app, open **Maya** (Route A): the bus should now be
      driven by the **driver feed** (watch it move as the driver streams).
- [ ] Try **Device GPS** while walking — the bus follows you (it must be within
      ~1.5 km of the route or the server rejects it as off-route).

### 2f. Subscription (billing)
- [ ] Home banner / Account → **Manage plan** → pick a plan → **Subscribe**.
- [ ] The button shows a brief processing state (checkout → confirm), then status
      flips to **Active** and persists. (Uses the mock payment provider — no real
      charge; a subscription only activates after the payment is confirmed.)

### 2g. Onboarding — add a child
- [ ] Account → **Add child** (or the Home **Add child** button).
- [ ] Pick a school (try **Mount Lebanon School**), then a route (**Route C**),
      then a stop; enter a name + grade → **Add child**.
- [ ] The new child appears on Home and starts tracking its route immediately.

### 2h. Sign out
- [ ] Account → **Sign out** → returns to login. Log back in → the child you
      added is still there (it was saved on the server).

---

## 2i. Operator dashboard (web)

- [ ] With the server running, open **`http://<LAN-IP>:3000/admin.html`** in a
      browser.
- [ ] Sign in with operator phone `+961 3 999 000` (prefilled) → code auto-fills
      → **Verify**.
- [ ] You see **Beirut International College**, totals (2 routes / 2 buses /
      2 children), and a live table of Route A & B updating every 2s (status,
      current→next stop, progress). _(Route C belongs to the other school and is
      correctly not shown.)_
- [ ] Optional: operator `+961 3 999 111` shows **Mount Lebanon School** (Route C).
- [ ] **Add child:** in the **Children** card enter a name, grade, parent phone,
      and address; pick a **Bus** (or leave the first), search a place and tap the
      map to drop the **home pin** → **Add child**.
- [ ] **Add a second bus:** in "Add a bus (list)" type a name (e.g. `Bus 2`) →
      **Add bus**. A new empty bus group appears; move a child into it with the
      row's **Bus** dropdown.
- [ ] **Arrange a bus:** in a bus group use ▲▼ to order it, set **"by"** (e.g.
      `07:30`) → **Save order & times**. That bus's **Pickup** times fill in.
- [ ] **Assign vehicle & driver:** in "Assign vehicle & driver" pick a bus, fill
      plate/driver/phone → **Assign**. (That driver phone can now log in.)
- [ ] **Edit driver:** click **edit** on a bus row, change the driver → the row
      updates.

## 3. Security spot-checks (optional, reassuring)

- [ ] With the server running, `curl http://<IP>:3000/api/me/children` **without**
      a token → `401`.
- [ ] There is **no** public positions endpoint: `curl .../api/positions` → `404`.
- [ ] Server logs show `denied subscribe`/`denied gps` if a client ever asks for
      a route it isn't authorized for.

---

## 4. Postgres (optional — swap memory for a real DB)

- [ ] `cd server && docker compose up -d` (starts Postgres).
- [ ] In `server/.env` set `USE_PRISMA=true`.
- [ ] `npm run prisma:migrate` then `npm run prisma:seed`.
- [ ] `npm run dev` — same behavior, now backed by Postgres. Confirm login and
      children still work (data now comes from the DB).

---

## 5. Real push delivery (beyond local notifications)

Server-side push is built and unit-tested, but **delivery** needs two things not
required for the local-notification demo in section 1:

- [ ] An **EAS `projectId`** in `app.json → expo.extra.eas.projectId`, and a
      **physical device** (Expo push tokens don't mint on simulators).
- [ ] The server host must be allowed to reach **`exp.host`** (network egress).

With both in place: log in on the device (registers its push token), start a
driver route, then **background the app** — you should still receive the
"stops away" push. Server logs show `Sent N push message(s)`.

---

## Known caveats

- Android maps in **Expo Go** need a Google Maps API key + a dev build; the
  **Stops** schematic is the always-works fallback.
- OTP codes are logged/returned in dev only — wire an SMS provider for release.
- Push tokens and driver routes are demo-seeded; onboarding (adding your own
  child) is the next feature.
