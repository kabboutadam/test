# ChiefStaff — phone app

Expo + expo-router. Brief, decision inbox, waiting-on, settings. Links to the
server with a code the web shows under Settings; never touches Google.

## Run it in Expo Go (free, no push)

```bash
npm install
npx expo start
```

Scan the QR with Expo Go. On a real phone `localhost` is the phone, so first
set `expo.extra.apiUrl` in `app.json` to your computer's Wi-Fi address, for
example `http://192.168.1.20:3000`, with the server running (`npm run dev` in
the parent folder). Then on the web: Settings → Link your phone.

## Why some native packages are pinned

Expo ships its native modules as prebuilt frameworks, and every one of them
has to come from the same SDK release. A transitive dependency with a loose
version range can quietly pull a module from the *next* SDK, and the result is
not a build error but a crash before the first frame:

- `expo-font` 57.x via `@expo/vector-icons` → the app dies at launch with
  `dyld: Symbol not found: ExpoModulesCore.AppContext.from(runtime:)`
  (referenced from ExpoFont.framework). This is a TestFlight-only crash;
  simulator debug builds do not use the prebuilt frameworks and run fine.
- `react-native-reanimated` 4.6 via `expo-router` → needs a newer
  `react-native-worklets` than Expo's core; native build fails with
  `no member named 'executeSync'`.

The pins in `package.json` (and the matching `overrides`, which win over any
transitive range) are the versions from Expo SDK 56's own
`bundledNativeModules.json`. After any `npm install`, this one-liner should
print nothing:

```bash
node -e 'const b=require("./node_modules/expo/bundledNativeModules.json"),l=require("./package-lock.json").packages;for(const[n,r]of Object.entries(b)){const e=l["node_modules/"+n];if(!e)continue;const w=r.replace(/^[~^]/,""),h=e.version;if(!(r.startsWith("~")?h.split(".").slice(0,2).join(".")===w.split(".").slice(0,2).join("."):h.split(".")[0]===w.split(".")[0]))console.log("MISMATCH",n,h,"wants",r)}'
```

When upgrading the SDK, update the pins from that file, or run
`npx expo install --fix`.

## TestFlight (needs an Apple Developer account, $99/year)

Push notifications on iPhone require the paid Apple Developer Program. There is
no free route to push.

One-time setup:

```bash
npm install -g eas-cli
eas login
eas init
```

`eas init` writes the project id into `app.json`. Then point `apiUrl` at a
public server URL — a TestFlight build on a phone in a café cannot reach your
laptop — and build:

```bash
eas build --platform ios --profile testflight
```

First build asks to sign in with your Apple ID and to create signing
credentials and a push key; say yes to everything. When it finishes:

```bash
eas submit --platform ios --latest
```

That uploads to TestFlight. Subsequent builds are the same two commands.

The server URL is editable inside the app (on the link screen, and under
Settings), so a server move or tunnel restart never needs a rebuild.

Profiles: `testflight` for TestFlight, `preview` for an ad-hoc install link,
`development` for a dev client with fast refresh, `production` for the App
Store.

## Making the server public for testing

For your own phone, a free tunnel is enough:

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:3000
```

It prints an `https://…trycloudflare.com` URL. Put that in `apiUrl` (and in
`APP_URL` in the server's `.env`, so the brief email links there too). The URL
changes every time you restart the tunnel; that is fine for testing and wrong
for anything else.
