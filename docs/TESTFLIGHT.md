# Shipping BusMapp to TestFlight

This gets the iOS app onto TestFlight so you and other testers can install it on
real iPhones. The build and upload run **on your Mac/PC**, not from the cloud —
they need an interactive Apple login (2FA) and Expo's build servers.

> **Current state (v0.3.1):** the app is in **backend mode**
> (`app.json → expo.extra.useBackend = true`, `apiBaseUrl` →
> `https://busmapp-api.onrender.com`). Testers sign in with a phone number and
> see live data, so **the server must be deployed and reachable first** and a
> school + kids must exist on it — otherwise testers hit a dead login. On a real
> iPhone the map uses **Apple Maps** (no API key needed).
>
> This 0.3.1 build carries **native changes** (background driver location), so it
> must be a full build — it can't ship as an OTA update. Later JS-only changes go
> out over the air (see §5).

## 0. Prerequisites (one time)

- [ ] **Apple Developer Program** membership ($99/yr) — required for TestFlight.
      https://developer.apple.com/programs/
- [ ] A free **Expo account** — https://expo.dev/signup
- [ ] Node 18+ and the EAS CLI:
      ```bash
      npm install -g eas-cli
      eas login
      ```

## 0.5 Get the code onto your Mac (every time)

The build runs from a **local clone on your Mac** — this project lives on GitHub
(and in Claude Code on the web), not on your machine by default. If you see
`fatal: not a git repository`, you're in the wrong folder. Clone it once, then
just `git pull` before each build:

```bash
cd ~
git clone https://github.com/kabboutadam/test.git busmapp
cd busmapp
git checkout claude/school-bus-tracking-lebanon-6oxhjg
npm install
```

Next time, skip the clone — `cd ~/busmapp` and `git pull origin claude/school-bus-tracking-lebanon-6oxhjg`.

> **Paste commands one line at a time, without the `# …` notes.** In zsh a `#`
> on the command line is **not** a comment — pasting `eas build … # ~15 min`
> makes zsh choke with `Unexpected arguments: #, …`. Copy only the command.

## 1. Link the project to EAS (one time — already done)

The project is linked: `app.json` carries the real `projectId`
(`expo.extra.eas.projectId`) and the matching `updates.url`. If you ever move
this to a different EAS account, re-run `eas init` and update both values.

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

### Invite message (paste the link, then send)

> **You're invited to test BusMapp 🚌**
> 1. On your iPhone, install **TestFlight** from the App Store.
> 2. Tap this link, then **Accept → Install**: **PASTE_TESTFLIGHT_LINK_HERE**
> 3. Open **BusMapp** and sign in with your **phone number** — you'll get an SMS
>    code. Your role is set automatically:
>    - **Parent** → track your child's bus (live map, "stops away", pickup time).
>    - **School** → add kids with their home pin + parent's phone, group into
>      buses, arrange order, set arrival time; pickup times fill in automatically.
>    - **Driver** → Driver mode → **Device GPS → Start route**, allow location
>      (**Always Allow** so it works with the phone locked), mount the phone,
>      **Stop** when done.
>
> If the first action seems slow, the server was asleep — wait ~30–60s and retry.
> Send feedback right in TestFlight (screenshot → share).

Note: for anything to appear, the **school must be set up on the server first**
(super-admin creates the school + a school login; the school adds kids).

## 5. Shipping updates

**EAS Update is wired and ready** (`expo-updates` installed; `app.json` has
`runtimeVersion` + a real `updates.url`; `eas.json` build profiles have channels
`development`/`preview`/`production`). No further setup needed.

> **Important:** OTA only reaches a build with a **matching `runtimeVersion`**
> (policy = `appVersion`), so an update lands only on builds of the **same app
> version**. The current baseline is **v0.3.1** — once testers are on the 0.3.1
> build, JS-only changes reach them over the air. Bumping `expo.version` again
> starts a new baseline and requires a fresh build for testers to keep getting
> updates.

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

- **`eas submit` prints "Something went wrong when submitting your app to Apple
  App Store Connect" — but the build still appears in TestFlight.** Seen with the
  current App Store Connect API key: it can *upload* the binary but can't *read
  submission status back*, so the CLI reports failure after a successful upload.
  **Don't rebuild — check App Store Connect → TestFlight first.** If the build is
  there, it worked; just handle "Missing Compliance" (answer No to encryption)
  and assign it to your testers. To silence the error for good, give the key the
  **App Manager** role (App Store Connect → Users and Access → Integrations).
- **`eas submit` fails and the build is genuinely missing:** resubmitting the
  *same* build number won't work if Apple already has it. Cut a fresh build
  (`autoIncrement` bumps the number) and submit that.
- **New build doesn't include your latest changes:** the build runs from your
  local working copy — `git pull` the branch on your Mac before `eas build`.
- **`fatal: not a git repository`:** you're not inside the project folder. Clone
  it and `cd` in — see §0.5.
- **`Unexpected arguments: #, …` from `eas`/`git`:** you pasted an inline `# …`
  note with the command. zsh doesn't treat `#` as a comment on the command line
  — paste only the command.
- **`eas build` fails to start / wrong project:** run `eas login` as the Expo
  account that owns this app's `projectId` (in `app.json`). `eas whoami` shows
  who you're logged in as.
- **Driver location stops when the phone locks:** the driver granted only "While
  Using." Have them open iOS **Settings → BusMapp → Location → Always** (the app
  also prompts for this). With "While Using," background tracking pauses when the
  app leaves the foreground; the Driver screen's status line says which mode is
  active.
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

### Dedicated bus device — sideloadable APK (no Play Store)

For a cheap phone kept in the bus, skip the store and install an APK directly:
```bash
eas build -p android --profile driver-device
```
The `driver-device` profile (in `eas.json`) extends `production` — same server
and `production` OTA channel — but outputs a **`.apk`** with `internal`
distribution. EAS gives a download link; open it on the phone (allow "install
from unknown sources"). Log in with that bus's registered driver number →
Driver mode → **Start route**. See "Onboarding a driver" in `docs/MULTI_TENANT.md`.
