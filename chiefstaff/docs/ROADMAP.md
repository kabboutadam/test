# Roadmap

Ordered by what the product needs, not by what's easy.

## V1 — shipped in this repo

- Google Workspace ingest (Gmail, Calendar), read-only
- Signal normalization and person resolution with observed importance
- Claude triage → decision inbox with drafted responses
- Open-loop tracking ("you're waiting on")
- Daily brief
- Seeded demo executive so output quality is judgeable without credentials

## V1.1 — make it real for one person

The gap between "runs" and "someone uses it every morning."

1. **Scheduled delivery.** A worker that runs the pipeline before `briefHour` in
   the user's timezone and pushes the brief. Mobile push + email; the web app is
   where you go *after* the notification, never the way you find out.
2. **Incremental Gmail sync** using `historyId` (the `Connection.cursor` column
   is already there).
3. **Real job queue.** `runPipeline` in a route handler doesn't survive a second
   user.
4. **Triage eval set.** 100 hand-labelled signals with a should-surface verdict,
   run on every prompt change. Without this, every prompt edit is a guess — and
   triage precision *is* the product.
5. **Feedback loop.** "Not mine" dismissals are the highest-quality training
   signal available; today they're recorded and unused.

## V2 — the second and third features people pay for

6. **Meeting prep**, fired 30 minutes before each meeting: attendees, last
   interaction, open threads with these people, what you said you'd do.
7. **Ask anything**, with citations, over the executive's real corpus. This is
   where pgvector and a retrieval layer earn their place — not before.
8. **Delegate access** for the chief of staff / EA. Scoped, explicit, revocable,
   logged. Extends the source-permission model rather than bypassing it. This is
   also a distribution feature: the CoS is the daily user and the champion.
9. **Second connector.** Slack for escalations, or the company's system of record
   (HubSpot, Jira, the ERP) for "what's actually happening." Slack is the better
   demo; the system of record is the better moat.

## V3 — enterprise

10. **Audit log** over every read and every generated artifact.
11. **SOC 2 Type II.** It will be asked for on the first real deal, and the
    answer "we're working on it" costs six months.
12. **Data residency** options. EU executives will ask.
13. **Admin-consent install** for Microsoft 365 alongside Google.

## Deliberately not doing

- **Auto-send.** Not in V1, not in V2. Possibly never for anything the executive
  hasn't approved a template for.
- **A generic dashboard.** Every attempt to add "an overview of everything" is a
  step back toward the product that doesn't get opened.
- **Being the system of record.** ChiefStaff reads; the CRM, the ERP and the
  inbox stay authoritative.

## Business shape

- Sell to the chief of staff, not the CEO — they're the buyer, the daily user
  and the champion.
- Price per executive seat at $300–500/month. This is not a $20 SaaS, and
  pricing it like one destroys the margin that pays for Opus-tier triage.
- The wedge is the decision inbox. Integrations are the moat. The model is
  neither.
