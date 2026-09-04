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
eas build --platform ios --profile preview
```

First build asks to create signing credentials; say yes to everything. When it
finishes, `eas submit --platform ios` sends it to TestFlight. Subsequent
builds are the same two commands.

The `development` profile is for a dev client with fast refresh on a real
device; `production` is for the App Store.

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
