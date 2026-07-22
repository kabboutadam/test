# Shipping BusMapp to TestFlight

This gets the iOS app onto TestFlight so you and other testers can install it on
real iPhones. The build and upload run **on your Mac/PC**, not from the cloud —
they need an interactive Apple login (2FA) and Expo's build servers.

> **First build recommendation:** ship in **simulator mode** (the current
> default, `app.json → expo.extra.useBackend = false`). The app is then fully
> self-contained — buses move on their own, no login, no server needed — so
> testers get the whole parent experience the moment they open it. Switch to
> backend mode only after you've deployed the server somewhere public (see the
> end of this doc). On a real iPhone build the map uses **Apple Maps** and works
> with no API key.

## 0. Prerequisites (one time)

- [ ] **Apple Developer Program** membership ($99/yr) — required for TestFlight.
      https://developer.apple.com/programs/
- [ ] A free **Expo account** — https://expo.dev/signup
- [ ] Node 18+ and the EAS CLI:
      ```bash
      npm install -g eas-cli
      eas login
      ```

## 1. Link the project to EAS (one time)

From the repo root:

```bash
eas init
```

This creates an EAS project and writes its `projectId` into `app.json`
(`expo.extra.eas.projectId`, currently a placeholder). Commit that change.

## 2. iOS signing credentials

EAS can create and manage the distribution certificate + provisioning profile
for you. The first build will prompt:

```bash
eas build --platform ios --profile production
```

- When asked to log in to your Apple account, do so (this is the interactive
  2FA step that can't be automated).
- Let EAS **generate credentials** unless you already manage your own.
- The build runs on EAS's servers (~10–20 min) and produces a signed `.ipa`.

`bundleIdentifier` is preset to `com.busmapp.app` — change it in `app.json` if
that identifier is taken in your account, then re-run.

## 3. Submit the build to TestFlight

```bash
eas submit --platform ios --profile production --latest
```

- Authenticate with your Apple account (or an **App Store Connect API key** —
  recommended for CI; create one under App Store Connect → Users and Access →
  Integrations → App Store Connect API).
- EAS uploads the build to App Store Connect. It appears under **TestFlight**
  after Apple finishes processing (a few minutes to ~an hour).

Export compliance is pre-answered (`ITSAppUsesNonExemptEncryption: false` in
`app.json`), so you won't be asked about encryption each time.

## 4. Add testers (App Store Connect → your app → TestFlight)

- **Internal testers** (up to 100, must be in your team): add them by email;
  builds are available immediately, no review.
- **External testers** (up to 10,000, anyone): create a group, add the build,
  fill in "What to Test" + basic app info. The **first** external build needs a
  short **Beta App Review** by Apple (usually a day). After approval you get a
  **public invite link** you can share with anyone.

Testers install the **TestFlight** app from the App Store, then open your invite
(or link) to install BusMapp.

## 5. Shipping updates

**EAS Update is already wired** (`expo-updates` installed; `app.json` has
`runtimeVersion` + `updates.url`; `eas.json` build profiles have channels
`development`/`preview`/`production`). One-time, after `eas init`:

```bash
eas update:configure     # finalizes updates.url with your real projectId
```

- **JS-only changes** (most of this app — screens, logic, styles): push instantly
  to installed TestFlight builds, no rebuild, no re-review:
  ```bash
  eas update --branch production --message "what changed"
  ```
  Builds made with the `production` profile are on the `production` channel and
  pick up the matching branch on next launch.
- **Native or config changes** (new native module, icon, permissions, or a bump
  of the app `version` — which changes `runtimeVersion`): these need a new
  build + submit:
  ```bash
  eas build -p ios --profile production && eas submit -p ios --latest
  ```

> `runtimeVersion` uses the `appVersion` policy: an OTA update only lands on
> builds whose app version matches. Bump `expo.version` only when you ship a new
> native build, so updates and binaries stay compatible.

## Going live with the backend (later)

To have testers use the **real server** (login, live driver GPS, operator
dashboard) instead of the built-in simulator:

1. Deploy `server/` to a public host (Railway, Fly.io, Render, a VPS…). Set a
   strong `JWT_SECRET`; use Postgres (`USE_PRISMA=true`) so data persists.
2. In `app.json` set `expo.extra.useBackend = true` and
   `expo.extra.apiBaseUrl = "https://your-server.example.com"` (HTTPS).
3. Rebuild + resubmit. Now the app shows the phone-OTP login and streams live
   data. (Wire a real SMS provider first — see `server/README.md` — otherwise
   testers can't receive codes.)

## Troubleshooting

- **Build fails on `react-native-maps` with the New Architecture:** as a
  fallback set `expo.newArchEnabled = false` in `app.json` and rebuild.
- **"Invalid bundle identifier / already exists":** pick a unique
  `ios.bundleIdentifier` in `app.json`.
- **Remote push notifications don't arrive:** they need the EAS `projectId`
  (set by `eas init`) and a physical device; local "approach" alerts work
  regardless. See `docs/PLAN.md` (Phase 3b).

## Android (optional)

The same project builds for Google Play internal testing:
```bash
eas build -p android --profile production
eas submit -p android --latest
```
Android maps need a Google Maps API key in `app.json`
(`android.config.googleMaps.apiKey`).
