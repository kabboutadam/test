# Going live — the launch checklist

Everything needed to take BusMapp from "working" to "a real school relies on it."
Ordered by what actually blocks launch. Aim for a **1-school pilot** first, not a
public App Store launch — a much lower bar.

## Already done ✅
- Full product: school setup (kids, home pins, multiple buses, auto pickup
  times), driver mode with background tracking + pickup list, parent live
  tracking + "stops away" + alerts, delete-bus, Lebanon phone normalization.
- Backend **live and always-on** (Render Starter).
- **SMS live** (Twilio) — confirmed on Lebanese numbers.
- Super-admin onboarding; per-family privacy; school-pays-parents-free gate.
- **Privacy Policy + Terms** served at `/privacy.html` and `/terms.html`.

## 🔴 Blockers — before a real school uses it

### 1. Persistent database (do first)
Render's **free** Postgres expires and can be deleted. Move to a permanent DB.
Recommended: **Neon** (free, permanent).
1. neon.tech → sign up → **Create project** (region: Europe / Frankfurt).
2. Copy the **Direct connection** string (toggle *off* "Pooled" — the host has no
   `-pooler`). Our server runs `prisma db push` on boot, which needs a direct
   connection.
3. Render → `busmapp-api` → Environment → set **`DATABASE_URL`** to the Neon
   string → Save. It redeploys and seeds.
> Switching DBs starts fresh (test data resets) — do this before real data.

### 2. Fill in the policy contact details
`server/public/privacy.html` and `terms.html` have `[ your contact email ]` and
`[ your WhatsApp / phone ]` placeholders — replace both. These pages are the
privacy-policy URL Apple requires.

### 3. Apple Developer account + the app build
The app isn't on any phone yet.
1. Enrol in the **Apple Developer Program** ($99/yr).
2. On your Mac, in a clone of this repo (`git clone …`, `cd`, `git checkout` the
   branch, `npm install`) — see `docs/TESTFLIGHT.md`:
   ```
   eas login
   eas build --platform ios --profile production
   eas submit --platform ios --profile production --latest
   ```
3. Add the **privacy-policy URL** (`https://<server>/privacy.html`) in App Store
   Connect, and fill the app privacy "nutrition label" (collects: phone,
   location, contact — not used for tracking/ads).
4. Android drivers: `eas build -p android --profile driver-device` → sideloadable
   APK (see TESTFLIGHT.md).

### 4. Confirm SMS is production-ready
- `SMS_PROVIDER=twilio` on the server (not left in `console` from testing).
- Twilio account funded (off trial), Lebanon geo-permission on.
- The dashboard banner should read **green "SMS: live (Twilio)."**

### 5. Real end-to-end test on real devices
One phone as **driver** (background tracking, phone locked) + one as **parent**
(live map + arrival alert), against a real seeded school. Never been run on
hardware yet — do this before onboarding anyone.

## 🟡 Right after launch (not blockers)
- **Payments:** invoice schools manually (bank transfer / OMT) and flip their
  access in the super-admin dashboard. A payment gateway comes later.
- **Self-host OSRM** for road times (public demo is fine at pilot volume) — see
  `docs/DEPLOY.md`.
- **Uptime + error alerts** and **database backups** so you know if it's down at
  7am.
- **Support channel** (WhatsApp) for schools/parents.

## Fastest path to a live pilot
1. Neon DB → 2. Fill policy contacts → 3. Apple account + TestFlight build →
4. Confirm SMS → 5. Onboard one friendly school + a few real parents →
6. Run a real morning, fix what breaks, then expand.
