# Spec alignment

Section-by-section status against *Chief — Product Spec v0.1* (Adam Kabbout,
4 Sep 2026). Updated whenever a section moves.

Legend: **Built** — in the code, verified against a database. **Partial** —
part of it. **Needs an account** — the code path exists up to the point where
a third-party developer account is required. **Post-MVP** — the spec itself
puts it after the first 90 days.

## 5.1 Daily Brief

| Element | Status | Where |
|---|---|---|
| Needs you, with one-click actions | **Built** — approve, not mine, snooze (tomorrow / next week), delegate (opens a loop), log as decision | inbox, phone |
| What moved — up to three, relative to own history, tunable | **Built** — z-score against the metric's last 12 periods; "not useful" raises that metric's threshold by 0.5σ | `src/core/metrics.ts` |
| Who to talk to | **Built** — overdue commitments per person, and people who have gone quiet; phrased as a reason, never a verdict | `src/core/people-signals.ts` |
| Today, annotated with prep | **Built** — 1:1s get "prep ready" and a link | brief, phone |
| Cause inferred for a movement | Not built. Deterministic sentence with comparison basis only. A model step to propose a cause from related metrics is the natural next addition. |
| Weekly / monthly editions | Not built. |
| Stale-source flag | **Built** — a metric with no data in 14 days is named in the brief | `staleMetrics` |
| Delivered by email + phone push, 90-second read | **Built** | `src/core/deliver.ts` |

## 5.2 Decision Log with loop-closing

| Element | Status |
|---|---|
| Record: decision, date, decider, rationale, expected outcome, owner, review date | **Built** — web form (under a minute), phone, API |
| Measurable expectation tied to a metric | **Built** — optional metric + expected value |
| Manual entry | **Built** |
| "Log it?" from an inbox item | **Built** — one click on any needs-you item pre-fills the form |
| Email-forward capture | Needs an inbound mail address (a paid service). Not built. |
| Suggested from transcripts / Slack | Post-MVP per spec. |
| Loop-closing on the review date | **Built** — becomes one review item in the inbox, exactly once, with the metric comparison done where the data allows and a one-line ask to the owner where it doesn't |
| Outcome: hit / miss / mixed / dropped | **Built** |
| Hit rate by category and decider | **Built** |

## 5.3 Commitment tracking

| Element | Status |
|---|---|
| Commitments others made to the CEO, from email | **Built** — "waiting on" |
| Commitments the CEO made to others, from email | **Built** — "you owe", shown in 1:1 prep |
| From Slack | Needs a Slack app. Not built. |
| From meeting transcripts | Post-MVP per spec. |
| Confirmation request to the committer | Not built. Requires sending on the CEO's behalf, which the product currently never does; a design decision, not an omission. |
| Overdue accumulation feeds "who to talk to" | **Built** |
| No task board | Correct — there isn't one. |

## 5.4 Meeting prep

| Element | Status |
|---|---|
| 1:1s: open commitments both directions, metrics in their area, decisions they own up for review, last topics | **Built** — deterministic, from data already held; generated for the next 24h on every run |
| 30 minutes before, on demand | Generated at each pipeline run and each "Sync now". A 30-minutes-before push is a scheduler addition, not built. |
| Leadership / board / external meetings | Post-MVP per spec. |
| Post-meeting summary | Post-MVP per spec. |

## 5.5 People early-warning — post-MVP per spec

Not built, and the spec's guardrails are already the ones the code follows:
"who to talk to" uses cadence and commitments only, never message content.

## 5.6 Ask Chief — post-MVP per spec

Not built.

## 5.7 Drafted responses

**Built**, ahead of the spec's schedule: every needs-you item comes with a
draft in the executive's register. Nothing is ever sent by the system.
Voice learned from sent mail: not built.

## 6. Integrations

| Integration | Status |
|---|---|
| Google Workspace (Gmail, Calendar) | **Built**, read-only, incremental |
| Spreadsheet / CSV for metrics | **Built** — the "generic connector early" the spec's risk section asks for; it is how a controller's weekly spreadsheet gets in |
| QuickBooks Online | Needs an Intuit developer account and OAuth app. Maps onto `Metric`: P&L lines by class (location), AR aging buckets, cash. |
| Toast | Needs a Toast partner account. Maps onto `Metric`: net sales, labour %, prime cost per location per day. |
| Gusto | Needs a Gusto developer account. Maps onto `Metric`: hours, overtime hours, labour cost per location per pay period. |
| Slack | Needs a Slack app. Would feed `Signal` (same shape as email). |
| Microsoft 365 | Post-MVP per spec. |

Every connector above feeds either `Signal` (things that happened) or `Metric`
(numbers over time). Nothing downstream knows which source a row came from.

## 7. Non-goals — held

No dashboards, no charts, no boards, no tickets, no autonomous action.

## 8. MVP scope — where it stands

| In scope per spec | Status |
|---|---|
| Daily Brief with Needs you, What moved, Today | **Built** |
| Decision Log, manual + email-forward | **Built** except email-forward |
| Meeting prep for 1:1s | **Built** |
| QuickBooks, Google Workspace, Slack, Gusto, Toast | Google built; the other four need accounts |
| Web app + daily email brief | **Built**, plus a phone app with push |

## 9. Success metrics — what is instrumented

"Source clicked" and "brief opened" are not yet recorded. Movement
"useful / not useful" is. Loop-closing rate is computable from
`DecisionRecord` today.

## 10. Risks — what the code already does

- **Messy SMB data**: stale sources are named in the brief; a metric needs four
  periods of history before it can move at all.
- **False alarms**: threshold starts at 2σ, the comparison basis is always in
  the sentence, and "not useful" tightens the metric.
- **Privacy**: no people signal reads message content.
