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

Cheap filtering happens here, before any tokens are spent: the Gmail query
excludes promotions and social, and `isBulkSender` drops no-reply addresses.
Claude should only ever see plausible candidates.

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
- **No job queue.** `runPipeline` is called synchronously from a route and a
  script. This is correct for one executive and wrong for a hundred — the
  morning run needs a real worker before the second customer.
- **No incremental Gmail sync.** The `Connection.cursor` column exists for
  `historyId` but is unused; the current sync re-lists a 7-day window and relies
  on the uniqueness constraint. Fine at this size, wasteful at scale.
