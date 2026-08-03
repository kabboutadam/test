# Multi-tenant model — schools, isolation, and access

BusMapp is sold **per school**: you (the platform owner) onboard schools across
Lebanon, each school manages *only its own* kids and addresses, and no school or
parent can ever see another's data. This doc explains how that works and how to
run it.

## Who's who

| Role | How they log in | What they can do |
| --- | --- | --- |
| **Super-admin** (you) | Your phone, listed in `SUPERADMIN_PHONES` | Create schools, provision each school's login, turn a school's access on/off |
| **Operator** (a school) | The phone you assigned them | Manage **only their school's** routes, buses, and children (add kids with a home pin) |
| **Parent** | Their phone (added by the school) | See **only their own** children and track their buses |
| **Driver** | The bus's driver phone | Stream **only their** bus's GPS |

Roles come from the phone number in the signed token — every endpoint derives
the school/parent from the token, never from the request body. That's the whole
security model: you can't ask for another tenant's data because the server only
ever looks up *your* tenant.

## Security guarantees (proven by tests)

`npm run --prefix server test:isolation` boots the real API and asserts, over
HTTP, that:

- an operator sees only their school's children and routes;
- an operator gets **403** trying to edit/delete another school's child or
  attach a bus to another school's route;
- a parent sees only their own child and can't delete another parent's;
- an operator can't reach the platform (super-admin) API, and a parent can't
  reach the school admin API;
- unauthenticated calls are **401**;
- when a school's access expires, its parents are locked out of tracking, and
  unlocked again when it's restored.

All 19 checks must pass. Run it in CI before every deploy.

## Access & billing (school pays, families track free)

Each school has a `subscriptionStatus` (`trial` / `active` / `expired` /
`none`). A parent is entitled to live tracking whenever **any of their kids'
schools is `active` or `trial`** — the app's paywall unlocks automatically, no
per-parent payment. You sell/renew or suspend a school with one call (below).
New schools default to a **14-day trial** so they can start immediately.

## Onboarding a school (super-admin)

1. Set your phone(s) as super-admin on the server:
   ```
   SUPERADMIN_PHONES="+961 3 XXX XXX"
   ```
   (comma-separate multiple owners). Restart the server.
2. Log in from the app or dashboard with that phone — you now hold a
   super-admin token. Then:

   ```bash
   # Create the school (returns its id, e.g. sch_ab12cd34)
   curl -X POST $API/platform/schools -H "authorization: Bearer $TOKEN" \
     -H 'content-type: application/json' \
     -d '{"name":"Tripoli Modern School","latitude":34.436,"longitude":35.834}'

   # Give the school its login (a phone that logs in as operator)
   curl -X POST $API/platform/schools/sch_ab12cd34/operators \
     -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
     -d '{"name":"Tripoli Ops","phone":"+961 71 111 111"}'

   # When they pay, activate (or 'expired' to suspend)
   curl -X PATCH $API/platform/schools/sch_ab12cd34/subscription \
     -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
     -d '{"status":"active","renewsAt":"2027-08-01"}'
   ```
   `GET /platform/schools` lists every school with route/child/operator counts.

## A school adds its own kids (operator)

The school never builds "routes." It just adds each child with their **home
address**, arranges the kids in **pickup order**, and the app computes each
child's **pickup time**. Three steps:

1. **Add each child** — name, grade, the **parent's phone**, a home-address
   label, and the **home pin** (search a place, then tap to fine-tune). No route
   to pick: the child joins the school's single pickup list automatically.
2. **Arrange the order** — put the kids in the sequence the bus collects them
   (first at the top) with the ▲▼ controls.
3. **Set "be at school by"** (e.g. `07:30`) and save. The app times every
   pickup — working backward from the arrival time, using **real road driving
   times** between homes (OSRM; falls back to a distance estimate if routing is
   unavailable, and tells you which was used) — and each parent sees their
   child's pickup time.

Behind the scenes: `POST /admin/children` (no `routeId` needed) drops the home
pin onto the school's auto-created pickup route and links/creates the parent by
phone; `POST /admin/arrange` reorders the pickups and back-fills every
`scheduledTime`. Everything is scoped to that school.

**Multiple buses.** A school that runs more than one bus adds a **bus** (a named
pickup list) with **Add bus**, then assigns each child to a bus and arranges
each bus on its own — its own order, its own "be at school by" time, its own
computed pickup times. Under the hood each bus is a route (`POST /admin/routes`
with just a name); `arrange` and add/move-child take an optional `routeId` to
target one bus, and `PATCH /admin/children/:id` with a `routeId` moves a child
between buses. A separate step assigns a **vehicle + driver** to each bus.

### In the app (school on their phone)

When a school operator logs into the **mobile app** with their phone, the app
detects the `operator` role and opens the **School** area instead of the parent
tabs:

- the school's kids **grouped by bus**, each in pickup order with their time;
- **Add child** → name, grade, parent phone, address, a **map you tap to drop the
  home pin** (Apple Maps on iOS, with place search), and — if there's more than
  one bus — which **bus** to add them to;
- **Add bus** → name a second/third pickup list;
- per-bus **Arrange** → move kids up/down, set that bus's school-arrival time,
  one tap to save the order and recompute times;
- tap a child to edit their details, move the pin, or move them to another bus.

The web dashboard (`/admin.html`) mirrors this exact flow for staff who prefer a
big screen, and stays the place for **bus/driver assignment**. Both hit the same
guarded, school-scoped API.

## Onboarding a driver

A driver's **phone number is their login and their identity** — there's no
separate driver app and no account to create. The same BusMapp app detects the
number and opens **Driver mode**, scoped to that one bus's route.

1. **Register the driver on their bus** (dashboard → the bus's *Assign vehicle &
   driver* card, or the app): enter plate, driver name, and the driver's **mobile
   number in full international format** (`+961 …`). Save. That number now owns
   that bus's route. One bus = one driver phone; swap drivers by editing the
   number (the old one instantly loses access).
2. **Put the app on a device** — the driver's own phone, or a cheap phone kept in
   the bus. It's the same app everyone uses:
   - **iOS:** the TestFlight build.
   - **Android (cheapest for a dedicated bus phone):** a sideloadable APK —
     `eas build -p android --profile driver-device` produces an `.apk` on the
     `production` channel (same server + OTA updates). Copy it to the phone and
     install (allow "install from unknown sources").
3. **Log in once** with that registered number → SMS code → verify. The app opens
   straight into **Driver mode** (their route only). A login lasts ~30 days, so a
   dedicated device re-authenticates roughly monthly.
4. **Each shift:** Driver mode → **Device GPS → Start route** → allow location
   (**Always Allow** so it keeps streaming with the phone locked/mounted) →
   **Stop** when the run ends.

Two things that must be right:

- **Phone format must match** what's registered. Spaces/dashes are ignored, but
  the **country code and leading `+` are not** — always use `+961…` everywhere.
- **Real SMS must be enabled** or the driver can't receive a code: set
  `SMS_PROVIDER=twilio` (+ `TWILIO_*`) on the server. In the default `console`
  mode the code is only logged, not texted. See `server/README.md`.

## Going live (backend notes)

The app is already in **backend mode** (`app.json → expo.extra.useBackend: true`,
`apiBaseUrl` → the deployed server). For a real, multi-tenant deployment make
sure the server is set up for production:

1. **Deploy `server/`** to a public host with Postgres:
   - set `USE_PRISMA=true` and `DATABASE_URL`, run `npm run prisma:migrate` then
     `npm run prisma:seed`;
   - set a strong `JWT_SECRET`, your `SUPERADMIN_PHONES`, and a real SMS
     provider (`SMS_PROVIDER=twilio` + creds) so operators/parents/drivers get
     codes — **without this, no one can log in on their own phone**;
   - point road-time routing at your own OSRM (`OSRM_URL`) before real volume.
2. **Keep the app pointed at it**: if you move the server, update
   `expo.extra.apiBaseUrl` and cut a new build (that value is baked in at build).
3. Onboard your first school as above, hand them the dashboard link, and register
   each bus's driver phone.

See `docs/DEPLOY.md` for host-specific steps.
