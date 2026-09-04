# ChiefStaff

An AI chief of staff for executives. Not a dashboard — a **decision inbox**.

Every executive already has five dashboards they don't open. Aggregation is the
obvious idea and it's the one that dies, because it's *pull* and executives don't
pull. ChiefStaff is push: it reads what's coming at you, decides the small
fraction that actually needs you, drafts the response, and asks you to approve.

Two clients — a phone app and a web app — over one server. The phone is the
product: the brief lands there by push at brief hour. The web is where you
connect Google and link the phone.

Five surfaces, in the order they matter:

| Surface | What it answers |
|---|---|
| **Decision inbox** | What needs me right now, and what should I say? Approve, snooze, delegate, log it. |
| **What moved** | Which numbers left their own normal range, against what, owned by whom? |
| **Waiting on / you owe** | What did I ask for that never came back — and what did I promise? |
| **Decision log** | What did we decide, what did we expect, and did it happen? |
| **Morning brief** | All of the above in under 90 seconds, with 1:1 prep attached. |

Product spec and section-by-section status: [`docs/SPEC-ALIGNMENT.md`](docs/SPEC-ALIGNMENT.md).

## Status

Working end-to-end scaffold. Gmail and Calendar ingest, entity resolution,
Claude-powered triage, open-loop tracking and brief generation all run. Ships
with a seeded fictional COO so you can judge the output quality before
connecting a real Google account.

Triage is measured against a labelled eval corpus, dismissals feed back into the
next classification, and a worker delivers the brief by email each morning in
the executive's own timezone.

Not yet built: mobile push, Slack, meeting prep, ask-anything retrieval,
delegate access. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Running it

Node 22 or newer.

```bash
cp .env.example .env      # fill in ANTHROPIC_API_KEY at minimum
docker compose up -d      # Postgres on :5432
npm install
npm run db:push           # create the schema
npm run seed              # a fictional COO with a realistic week of mail
npm run pipeline          # ingest -> triage -> loops -> brief, printed to stdout
npm run dev               # http://localhost:3000
```

Every script reads `.env` itself, so nothing needs exporting; a variable set in
the shell takes precedence over the file. Only the eval needs a key at all:

```bash
cp .env.example .env      # then set ANTHROPIC_API_KEY
npm install
npm run eval -- --runs 3
```

## The phone app

`mobile/` is an Expo app (same stack as BusMapp): brief, decision inbox,
waiting-on, settings. It never touches Google — it links to your account with a
six-character code the web shows under Settings, then holds a bearer token in
the keychain.

```bash
cd mobile
npm install
npx expo start          # scan the QR with Expo Go
```

On a real phone, `localhost` is the phone. Set `expo.extra.apiUrl` in
`mobile/app.json` to your Mac's LAN address (`http://192.168.x.x:3000`) while
the server runs with `npm run dev`. Push works only on a physical device and
only once the app is built with EAS; in Expo Go it registers quietly and does
nothing.

## The morning run

```bash
npm run worker                # consume jobs and schedule, forever
npm run worker -- --once      # one scheduler pass, drain, exit (cron)
```

For each executive, once their local clock passes `briefHour`: queue a pipeline
run, then a delivery — email if SMTP is configured, push to every linked phone,
and "delivered" means at least one of those actually reached them. Work goes through pg-boss on the Postgres already here —
no Redis — because the morning fans out to one expensive job per executive, and
a request handler owning N Claude calls stops working at the second customer.

Idempotent at three points, so a poll, a cron and someone hammering "Sync now"
can overlap safely: duplicate jobs collapse on the singleton key, a brief
already generated for today is not regenerated, and one already delivered is not
sent again.

Timezone comes from the executive, not the server. With no `SMTP_URL` set the
brief is printed to the console and left marked undelivered, so a misconfigured
deployment is loud rather than silently swallowing the product's only
notification.

## Numbers in

Metrics arrive as a CSV — the weekly spreadsheet a controller already sends —
under **Moved → Import**: columns `metric, period, value`, optionally
`segment, unit, good_when, owner`. Anomalies are detected against each metric's
own last twelve periods, never a fixed threshold; "not useful" makes that metric
quieter. QuickBooks, Toast and Gusto will feed the same table when their
accounts exist. See `docs/SPEC-ALIGNMENT.md`.

## Measuring triage

Triage precision *is* the product, so it has an eval rather than an opinion.
`evals/cases.ts` is a hand-labelled corpus of 43 signals — deliberately hard
ones: asks buried under 200 words of status, a board member's polite "no rush"
question, a vendor's ACTION REQUIRED that means nothing, a report narrating a
problem they already own.

```bash
npm run eval                  # score the classifier against the corpus
npm run eval -- --runs 3      # three passes; reports spread as well as mean
npm run eval -- --dry-run     # prompt and corpus stats, no API calls
```

Precision is the headline: an inbox that surfaces noise gets skimmed and then
ignored. But every miss prints in full with the model's own reasoning, because
one missed escalation costs more than a month of small false positives. The run
exits non-zero below 80% precision or 85% recall.

Add a case whenever triage gets something wrong in real use. That is the whole
maintenance loop.

The seeded user is browsable with no Google credentials at all —
`DEMO_USER_EMAIL` in `.env` signs you in as them.

### Connecting a real Google account

1. Create an OAuth client (type: **Web application**) in the
   [Google Cloud console](https://console.cloud.google.com/apis/credentials).
2. Add `http://localhost:3000/api/auth/google/callback` as an authorized
   redirect URI.
3. Enable the **Gmail API** and **Google Calendar API** for the project.
4. Put the client ID and secret in `.env`, then visit `/settings` and connect.

Scopes requested are `gmail.readonly` and `calendar.readonly` — nothing else.
The app holds no permission to send or modify anything.

## How it works

```
Google Workspace ──▶ connectors ──▶ Signal ──▶ triage ──▶ Decision
                                       │                     │
                                       └──▶ loops ──▶ Loop ──┴──▶ Brief
```

Connectors normalize everything into a `Signal`; nothing downstream knows about
Google. Entity resolution builds a `Person` graph from observed traffic, so
"importance" is measured rather than configured. Triage runs a batch of signals
through Claude and emits `Decision`s with drafted responses. A separate pass
tracks `Loop`s — asks the executive made that haven't come back. The brief is a
rendering of all three.

Details and the reasoning behind each choice:
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## The three rules this codebase is built around

1. **Permissions inherit from the source.** Everything is read with the
   executive's own credentials, so the system can only ever see what they can
   see. There is no service account with a superset of anyone's access.
2. **Never auto-send.** Draft and approve, always. One hallucinated email sent
   as the CEO ends the account, and no accuracy number makes that bet good.
3. **Every claim cites its source.** A brief line the executive can't click
   through to is a brief line they can't trust.

## Layout

```
prisma/schema.prisma     data model, commented with the product reasoning
src/connectors/          Google Workspace ingest; the only Google-aware code
src/core/                the pipeline: ingest, triage, loops, brief
src/lib/claude.ts        every Claude call goes through here, schema-constrained
src/app/                 Next.js app router surfaces
scripts/run-pipeline.ts  what the morning cron calls
evals/cases.ts           the labelled triage corpus — the real spec
evals/run.ts             scores the classifier, prints every miss
scripts/worker.ts        queue consumer + morning scheduler
src/jobs/queue.ts        two queues on pg-boss; policy notes matter here
src/core/deliver.ts      brief -> email, idempotent on deliveredAt
src/lib/time.ts          everything timezone-shaped, via Intl
```
