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

1. **Mobile push.** Email delivery ships; push does not. Email is where a brief
   goes to be read at 09:40, and the product promises 06:00.
2. **Gmail push notifications** (`users.watch` + Pub/Sub). Incremental sync
   makes polling cheap; push makes it immediate, which matters for escalations.
3. **Operational visibility.** Queue depth, failed jobs and per-executive sync
   health are currently only visible in Postgres.
4. **Grow the eval corpus** from 32 to ~100 cases, and add a second executive
   persona — a corpus built around one COO will overfit the prompt to her.
5. **Per-person calibration.** Dismissals currently go into the prompt as titles.
   The next step is holding out a per-executive threshold and measuring whether
   surfacing fewer, higher-confidence items raises daily usage.

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

0. **Google OAuth verification — start early.** `gmail.readonly` is a
   *restricted* scope. Test users (up to 100) work with no review, so the
   founding team and design partners are unblocked. Beyond that, Google
   requires app verification plus an annual third-party CASA security
   assessment: weeks of calendar time and a real invoice, and it surfaces two
   weeks before a launch if nobody started it. A `gmail.metadata` fallback tier
   (not restricted) exists but loses message bodies, which is most of triage's
   signal — a worse product, not a free option.

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
