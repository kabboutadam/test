# Architecture

## The shape of the product

The central bet: an executive product succeeds or fails on **what it decides not
to show you**. Aggregation is easy and worthless. The value is in the filter, and
the filter is the hard part.

That makes the architecture a funnel, not a dashboard:

```
sources ──▶ Signal ──▶ Person resolution ──▶ triage ──▶ Decision  ─┐
                                    │                              ├──▶ Brief
                                    └──────▶ loop tracking ──▶ Loop ┘
```

Roughly 90% of signals should die at triage. If the decision inbox has thirty
items in it, the product is broken — not busy.

## Layers

### Connectors (`src/connectors/`)

The only Google-aware code in the repo. Each connector returns `RawSignal[]`
(`src/connectors/types.ts`). Adding Slack, Linear, or a CRM means writing one
function that returns that shape; nothing downstream changes.

Auth is per-executive OAuth, not a workspace-wide service account. This is a
product decision as much as a technical one — see *Permissions* below.

### Signals (`src/core/ingest.ts`)

One normalized row per thing that happened, unique on
`(userId, source, externalId)` so sync is idempotent and re-running is free.

Cheap filtering happens here, before any tokens are spent: excluded Gmail labels
(promotions, social, spam, chat — but never SENT, since the executive's own
outbound is how open loops are detected) and `isBulkSender` for no-reply
addresses. Claude should only ever see plausible candidates.

Gmail sync is incremental via `historyId`, stored in `Connection.cursor`. The
first sync backfills a bounded 7-day window and reads the watermark *before*
listing, so anything arriving mid-backfill is re-seen next time and deduped
rather than skipped forever. After that the common path is one API call
returning nothing, against the ~150 a re-list costs. Gmail expires history after
about a week; a 404 on resume means backfill, not an outage.

### People (`src/core/people.ts`)

Entity resolution over observed traffic. `importance` is a computed score:
volume gets you noticed, recency keeps you there, and **the executive replying
to you counts for far more than you emailing them**. Anyone can email a CEO;
getting a reply means something.

Nothing here is user-configured. An executive will not maintain a VIP list, and
a product that requires one has already lost.

### Triage (`src/core/triage.ts`)

A batch of unprocessed signals goes to Claude with a schema-constrained output.
Batching is deliberate: an ask reads differently when the model can see the four
other threads about the same deal.

The prompt's whole job is holding the bar high. It enumerates what *doesn't*
qualify (FYI, newsletters, notifications, things a report should handle, threads
already answered) because a permissive triage pass is the failure mode that
kills the product.

Every item that passes gets a drafted response written to be sendable as-is.

### Loops (`src/core/loops.ts`)

Scans recent signals for asks the executive made that haven't come back, and for
answers that closed ones already open. Explicitly does not close a loop on a
non-answer — "will get to this" is not an answer, and treating it as one is how
the feature loses trust.

### Brief (`src/core/brief.ts`)

Reads the current state of decisions, loops and calendar and renders prose. It
is fed yesterday's brief so it can say what *changed* rather than repeating
itself.

Under 400 words, three fixed sections, no greeting, no sign-off. The constraint
is the feature.

## Claude usage

Every call goes through `src/lib/claude.ts`.

- **Model:** `claude-opus-5` with adaptive thinking. Triage quality is the
  product; this is the wrong place to save money.
- **Structured output everywhere** (`messages.parse` + zod). A triage pass that
  returns prose is a triage pass that silently breaks the inbox.
- **Prompt caching** on the system block. The triage and loop system prompts are
  long, stable, and sent on every batch — exactly the shape caching is for.
- **Refusals are checked explicitly.** `stop_reason === "refusal"` throws rather
  than falling through to an empty result.

### Cost

At current pricing, a working day is roughly 150 signals → ~8 triage batches +
1 loop pass + 1 brief ≈ 10 calls per executive per day. At a $300+/seat/month
price point the model cost is a rounding error, which is the correct ratio for
this product. Don't optimize it before the filter is good.

## Background work

Two queues on pg-boss, which runs on the Postgres already here rather than
adding Redis:

- `chiefstaff.pipeline` — sync, triage, loops, brief. Expensive; retried twice
  with backoff, because Google and Anthropic both fail transiently.
- `chiefstaff.deliver` — send the brief. Cheap, idempotent, retried eight
  times: a transient SMTP failure should never cost someone their brief.

They are separate so a pipeline failure cannot take the delivery of an
already-generated brief with it.

Both queues use pg-boss's `stately` policy. This is load-bearing and easy to get
wrong: on the default `standard` policy `singletonKey` is recorded and ignored,
so a five-minute poll quietly queues twelve identical pipelines an hour. A
queue's policy is fixed at creation and pg-boss will not update it, so
`src/jobs/queue.ts` warns loudly if it finds a queue with a stale policy rather
than dropping it and taking any queued jobs with it.

The web process sends but never supervises — maintenance running in two places
means two schedulers competing over the same tables.

Idempotency comes from three independent places, which is what makes a poll, a
cron and a manual sync safe to overlap: duplicate jobs collapse on the singleton
key, a brief already generated for today is not regenerated, and a brief already
delivered is not sent again.

## The phone

The phone never sees Google. It links to an already-signed-in web session with
a six-character code — the same pattern as linking a TV, chosen for the same
reason: typing on the small screen is the part to minimise. The code is
single-use, ten minutes, and excludes 0/O/1/I because these get read aloud
across a room. Redeeming it yields a bearer token shown exactly once; only the
SHA-256 is stored, and sign-out revokes it server-side.

`/api/v1` is deliberately thin: the server does the parsing (the brief comes
down as blocks, not markdown), so the phone carries no model-output handling at
all. Every write the phone can make is a status change on a row the user owns.

Push goes through Expo's service, which needs no account and relays to APNs and
FCM. It is best-effort by design: a failed push must never block the brief, so
`sendPush` reports rather than throws, and a token Expo marks
`DeviceNotRegistered` (the app was uninstalled) is forgotten on the spot.
"Delivered" means at least one channel — email or push — actually reached them.
The channels fail independently: an SMTP outage does not stop the push, and a
push outage does not stop the email. If a configured channel failed and nothing
reached them, delivery throws so the queue retries with backoff; if no channel
is configured at all, it reports and waits for the next scheduler pass, since
retrying that cannot help.

## Permissions

**The source is the permission system.** Every read uses the executive's own
OAuth credentials, so the app can only ever see what they can see. There is no
service account holding a superset of anyone's access, and there is no
permissions model of our own to get wrong.

This is the thing to get right before enterprise sales, not after. The
delegate/chief-of-staff access model (V2) must extend it rather than bypass it:
scoped, explicit, revocable, and logged — never "the EA logs in as the CEO."

Scopes are read-only. The app cannot send mail or modify a calendar, and that is
enforced at the OAuth grant, not in application code.

## Trust

Three properties, each load-bearing:

1. **Never auto-send.** `resolveDecision` records intent; it does not deliver.
   One hallucinated email sent as the CEO ends the account.
2. **Cite everything.** Decisions carry `citations` back to the source message.
   A claim the executive can't click through is a claim they can't check.
3. **Model output is never HTML.** `src/lib/markdown.tsx` renders the brief
   through React nodes rather than `dangerouslySetInnerHTML`, so a prompt
   injection sitting in someone's email cannot become script in the executive's
   browser. Treat all ingested content as hostile — it is written by people
   outside the company.

## What's deliberately missing

- **No vector search yet.** Retrieval matters for "ask anything" (V2), not for
  triage, which works on a bounded recent window. Adding pgvector before the
  filter is good is optimizing the wrong layer.
- **No admin surface.** Queue depth, failed jobs and per-executive sync health
  are visible only in Postgres. Fine for one operator, not for a support rota.
