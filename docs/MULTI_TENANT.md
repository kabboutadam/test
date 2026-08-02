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
   pickup — working backward from the arrival time and estimating travel between
   homes from the distance between pins — and each parent sees their child's
   pickup time.

Behind the scenes: `POST /admin/children` (no `routeId` needed) drops the home
pin onto the school's auto-created pickup route and links/creates the parent by
phone; `POST /admin/arrange` reorders the pickups and back-fills every
`scheduledTime`. Everything is scoped to that school.

### In the app (school on their phone)

When a school operator logs into the **mobile app** with their phone, the app
detects the `operator` role and opens the **School** area instead of the parent
tabs:

- a list of the school's kids **in pickup order**, each with their computed time;
- **Add child** → name, grade, parent phone, address, and a **map you tap to drop
  the home pin** (Apple Maps on iOS, with place search);
- **Arrange order & pickup times** → move kids up/down, set the school-arrival
  time, one tap to save the order and recompute times;
- tap a child to edit their details or move the pin; trash to remove.

The web dashboard (`/admin.html`) mirrors this exact flow for staff who prefer a
big screen, and stays the place for **bus/driver assignment**. Both hit the same
guarded, school-scoped API.

## Going live (this is backend work — the app is still in demo mode)

The TestFlight app currently runs in **demo mode** (`app.json →
expo.extra.useBackend: false`) and does not talk to this backend. To make the
multi-tenant system real:

1. **Deploy `server/`** to a public host with Postgres:
   - set `USE_PRISMA=true` and `DATABASE_URL`, run `npm run prisma:migrate` then
     `npm run prisma:seed`;
   - set a strong `JWT_SECRET`, your `SUPERADMIN_PHONES`, and a real SMS
     provider (`SMS_PROVIDER=twilio` + creds) so operators/parents get codes.
2. **Point the app at it**: `expo.extra.useBackend: true` and
   `expo.extra.apiBaseUrl: "https://your-server"`, then cut a new build.
3. Onboard your first school as above and hand them the dashboard link.

See `docs/DEPLOY.md` for host-specific steps.
