# ChiefStaff

An AI chief of staff for executives. Not a dashboard — a **decision inbox**.

Every executive already has five dashboards they don't open. Aggregation is the
obvious idea and it's the one that dies, because it's *pull* and executives don't
pull. ChiefStaff is push: it reads what's coming at you, decides the small
fraction that actually needs you, drafts the response, and asks you to approve.

Three surfaces, in the order they matter:

| Surface | What it answers |
|---|---|
| **Decision inbox** | What needs me right now, and what should I say? |
| **Waiting on** | What did I ask for that never came back? |
| **Morning brief** | What changed overnight, in under 400 words? |

"Waiting on" is the one nobody ships and the one executives fall in love with.

## Status

Working end-to-end scaffold. Gmail and Calendar ingest, entity resolution,
Claude-powered triage, open-loop tracking and brief generation all run. Ships
with a seeded fictional COO so you can judge the output quality before
connecting a real Google account.

Not yet built: Slack, meeting prep, ask-anything retrieval, delegate access,
scheduled morning delivery. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Running it

```bash
cp .env.example .env      # fill in ANTHROPIC_API_KEY at minimum
docker compose up -d      # Postgres on :5432
npm install
npm run db:push           # create the schema
npm run seed              # a fictional COO with a realistic week of mail
npm run pipeline          # ingest -> triage -> loops -> brief, printed to stdout
npm run dev               # http://localhost:3000
```

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
```
