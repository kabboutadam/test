import type { Category, TriageCandidate } from "../src/core/triage";

/**
 * The triage eval corpus.
 *
 * These are labelled by hand and they are the specification for what the
 * product considers "needs the executive". Two rules when adding cases:
 *
 * 1. A case earns its place by being *hard*. Obvious noise and obvious
 *    escalations tell you nothing on the second run. Buried asks, polite asks,
 *    loud non-asks and reports-narrating-progress are where triage actually
 *    fails.
 * 2. If you cannot defend the label to a skeptical COO in one sentence, the
 *    case does not belong here. A wrong label is worse than a missing one,
 *    because it will push the prompt in the wrong direction forever.
 */

/** Fixed so relative dates and "current time" never drift between runs. */
export const EVAL_NOW = new Date("2026-03-10T08:00:00Z");

export const EVAL_EXEC = {
  name: "Dana Reyes",
  email: "dana@northwind.example",
  role: "COO",
  company: "Northwind Logistics",
};

export interface EvalCase {
  id: string;
  /** One sentence defending the label. Read this when a run disagrees. */
  note: string;
  /** Cases sharing a group are batched together, in this order. */
  group?: string;
  signal: TriageCandidate;
  expect: {
    surface: boolean;
    category?: Category;
    urgency?: number;
  };
}

const EXEC = EVAL_EXEC.email;
const hoursAgo = (hours: number) => new Date(EVAL_NOW.getTime() - hours * 3_600_000);
const hoursAhead = (hours: number) => new Date(EVAL_NOW.getTime() + hours * 3_600_000);

function email(
  from: [name: string, address: string],
  subject: string,
  body: string,
  options: { hoursAgo?: number; cc?: string[] } = {},
): TriageCandidate {
  return {
    kind: "email",
    occurredAt: hoursAgo(options.hoursAgo ?? 12),
    fromName: from[0],
    fromEmail: from[1],
    participants: [from[1], EXEC, ...(options.cc ?? [])],
    subject,
    body,
  };
}

export const CASES: EvalCase[] = [
  // ---------------------------------------------------------------- surface
  {
    id: "buried-ask-in-update",
    note: "The ask is real and blocking; it is just sitting under 200 words of status.",
    expect: { surface: true, category: "approval", urgency: 2 },
    signal: email(
      ["Priya Raman", "priya@northwind.example"],
      "Rotterdam integration — week 6 update",
      `Hi Dana,

Week 6 status. The API cutover completed on Tuesday with no downtime. Throughput
is tracking at 94% of the modelled figure, which is inside tolerance. The two
open defects from last week are closed. Carrier onboarding is at 11 of 14, and
the remaining three have confirmed dates before the end of the month.

Training completed for the yard team; the night shift session slipped a week
because of the rota change but that does not affect the critical path.

One thing I need from you: the data processing addendum needs an officer
signature and I cannot send it back to their legal team without it. If it is not
signed by Thursday we lose the launch window and the next one is in May.

Priya`,
    ),
  },
  {
    id: "polite-board-question",
    note: "A board member asking the COO's read is a reply only she can give, however softly it is phrased.",
    expect: { surface: true, category: "reply", urgency: 1 },
    signal: email(
      ["Helena Ostrom", "helena@ostromcapital.example"],
      "Quick one when you have a moment",
      `Dana — no rush at all on this, I know you're deep in the integration.

I've been thinking about the hiring pause we discussed in January. Before the
next board call I'd like to understand your read on whether it's still the right
call given what Rotterdam has shown you about capacity.

Whenever suits.

Helena`,
    ),
  },
  {
    id: "safety-escalation",
    note: "Site lead has stopped work and explicitly cannot restart without the COO.",
    expect: { surface: true, category: "escalation", urgency: 3 },
    signal: email(
      ["Ines Marchetti", "ines@northwind.example"],
      "Antwerp — second near-miss, night shift stood down",
      `Dana,

Second near-miss at Antwerp in three weeks. No injuries. Same root cause as the
4th: the subcontractor's crews are working past the shift cap.

I've stood down the night shift pending review. The site lead is pushing back
hard because it costs them the week, and the contract says we need cause to
pause a crew.

I'm not comfortable restarting until we see their revised rota, but pausing a
contracted crew is above my authority. I need direction today.

Ines`,
      { hoursAgo: 3 },
    ),
  },
  {
    id: "auto-renew-trap",
    note: "Reads like billing admin, but it is a real decision with a hard date and a 40% increase.",
    expect: { surface: true, category: "approval", urgency: 2 },
    signal: email(
      ["Tomas Bergh", "tomas@northwind.example"],
      "Fleet telematics contract — auto-renews 14 March",
      `Dana,

Flagging this before it passes: the telematics contract auto-renews on 14 March
at a 41% uplift (€310k up from €220k). Cancellation notice has to be in writing
four days before, so 10 March is the last day.

I've had two alternative quotes in for a month, both cheaper, both a three-month
migration. My recommendation is to give notice now to preserve the option, then
decide properly — but giving notice on a live fleet system is your call.

Tomas`,
      { hoursAgo: 2 },
    ),
  },
  {
    id: "competing-offer-deadline",
    note: "Panel is split, external deadline, and only the COO breaks the tie.",
    expect: { surface: true, category: "approval", urgency: 2 },
    signal: email(
      ["Jules Adeyemi", "jules@northwind.example"],
      "VP Ops — panel is split, need your call",
      `Dana,

Both finalists cleared. Chen is stronger operationally; Okafor is stronger on
change management, which is the risk we flagged.

The panel is split three-two and more interviews won't fix it. Chen has a
competing offer with a decision date next Wednesday.

Can you take thirty minutes this week and make the call?

Jules`,
      { hoursAgo: 20 },
    ),
  },
  {
    id: "customer-churn-threat",
    note: "A customer executive escalating to the COO by name; delegating this makes it worse.",
    expect: { surface: true, category: "escalation", urgency: 3 },
    signal: email(
      ["Lena Fischer", "lena@meridiangroup.example"],
      "Escalating — third missed window this quarter",
      `Dana,

I've tried to keep this at the account level but I'm not getting anywhere.

Three missed delivery windows this quarter, and the last one cost us a
production stop. Your team has been responsive but nothing has changed.

I have a board meeting on the 19th where I have to recommend renew or re-tender.
I would rather recommend renew. I need to hear from you, not from account
management, what is actually being done.

Lena Fischer
COO, Meridian Group`,
      { hoursAgo: 5 },
    ),
  },
  {
    id: "resignation",
    note: "A direct report resigning is never delegable and is time-critical.",
    expect: { surface: true, category: "reply", urgency: 3 },
    signal: email(
      ["Marco Silva", "marco@northwind.example"],
      "Difficult note",
      `Dana,

This is hard to write. I've accepted an offer elsewhere and my last day would be
the 10th of April.

It isn't about the work or the team. Happy to talk whenever you have time, and I
want to do this in a way that doesn't hurt the Rotterdam programme.

Marco`,
      { hoursAgo: 1 },
    ),
  },
  {
    id: "regulator-signoff",
    note: "Requires an officer signature by statute; nobody else in the company can provide it.",
    expect: { surface: true, category: "approval", urgency: 2 },
    signal: email(
      ["Compliance Team", "compliance@northwind.example"],
      "Annual transport operator declaration — officer signature required",
      `Dana,

The annual operator declaration is due to the regulator by 20 March. It has to be
signed by a named officer of the company and you are the designated officer on
file.

I've completed the return and checked it against the depot records. It needs your
signature only — no further review.

If we miss the date the operator licence goes into review, which is a 6-8 week
process.`,
      { hoursAgo: 30 },
    ),
  },
  {
    id: "board-packet-review",
    note: "Explicitly sent for her input with a stated deadline, and the section is hers.",
    expect: { surface: true, category: "review", urgency: 1 },
    signal: email(
      ["Priya Raman", "priya@northwind.example"],
      "Q1 board packet — operations section needs your framing",
      `Hi Dana,

Draft Q1 board packet attached. The operations section is yours — I've put in
placeholder commentary on the Rotterdam delay but it needs your framing, not
mine.

We circulate Friday morning, so comments by end of Thursday please.

Priya`,
      { hoursAgo: 26 },
    ),
  },
  {
    id: "peer-conflict",
    note: "Two functions deadlocked and both report elsewhere; only the COO can break it.",
    expect: { surface: true, category: "escalation", urgency: 2 },
    signal: email(
      ["Sarah Kwon", "sarah@northwind.example"],
      "Need you to break a tie between us and Finance",
      `Dana,

Finance won't release the capex for the Antwerp racking until we produce a
utilisation case, and we can't produce a utilisation case until the racking is
in. We've been round this three times.

Ravi and I have both put our positions in writing and we genuinely disagree. I
don't think either of us is going to move without you.

Sarah`,
      { hoursAgo: 40 },
    ),
  },
  {
    id: "speaking-invite",
    note: "A genuine accept/decline decision that only she can make, but nothing turns on it this week.",
    expect: { surface: true, category: "reply", urgency: 0 },
    signal: email(
      ["Nadia Haddad", "programme@logisticsforum.example"],
      "Invitation to keynote — Logistics Forum, November",
      `Dear Ms Reyes,

We would be delighted if you would give the opening keynote at the Logistics
Forum in Lisbon on 12 November. Forty minutes, roughly 900 attendees, on any
topic within operational resilience.

We would need an answer by the end of April to finalise the programme.

With thanks,
Nadia Haddad`,
      { hoursAgo: 60 },
    ),
  },
  {
    id: "decision-meeting-no-preread",
    note: "She is the decider at a meeting in five hours with no material circulated.",
    expect: { surface: true, category: "scheduling", urgency: 3 },
    signal: {
      kind: "meeting",
      occurredAt: hoursAhead(5),
      fromName: "Marco Silva",
      fromEmail: "marco@northwind.example",
      participants: ["marco@northwind.example", EXEC, "sarah@northwind.example", "legal@northwind.example"],
      subject: "DECISION: Atlas renewal pricing — Dana to approve",
      body: "Final session before papers go to Atlas. Dana approves or we walk. No pre-read circulated yet.",
    },
  },

  // ------------------------------------------------------------ do not surface
  {
    id: "newsletter",
    note: "Bulk industry newsletter with no ask.",
    expect: { surface: false },
    signal: email(
      ["Supply Chain Weekly", "newsletter@supplychainweekly.example"],
      "5 trends reshaping freight in 2026",
      "This week: capacity tightening in the North Atlantic, three carriers announce rate changes, and what the new emissions rules mean for your fleet. Read online. Unsubscribe.",
    ),
  },
  {
    id: "loud-vendor-outreach",
    note: "Manufactured urgency from a cold vendor; the deadline is theirs, not hers.",
    expect: { surface: false },
    signal: email(
      ["Blake Turner", "blake@velocityfreight.example"],
      "ACTION REQUIRED: your Q1 optimisation review expires Friday",
      `Dana,

I've reserved a complimentary supply chain optimisation review for Northwind but
I can only hold the slot until Friday. Most COOs we work with find 12-18% in
avoidable spend within the first hour.

Can I put 30 minutes in the diary this week? This is time-sensitive.

Blake`,
    ),
  },
  {
    id: "report-has-it-handled",
    note: "A report narrating a problem they own and are already resolving; asks for nothing.",
    expect: { surface: false },
    signal: email(
      ["Ines Marchetti", "ines@northwind.example"],
      "Heads up — WMS outage this morning, resolved",
      `Dana,

For visibility: the warehouse system went down at 04:10 this morning for
forty minutes. Cause was a failed failover on the vendor side, not us.

We ran the manual process, nothing shipped late, and the vendor has committed to
a root cause by Friday. I've asked for service credits.

Nothing needed from you — just so you hear it from me first.

Ines`,
    ),
  },
  {
    id: "already-answered",
    note: "She already gave the answer; the reply acknowledges it and asks nothing further.",
    expect: { surface: false },
    signal: email(
      ["Tomas Bergh", "tomas@northwind.example"],
      "Re: Yard utilisation by shift",
      `Perfect, thanks Dana — going with option B as you said. I'll have the revised
model to the team by Wednesday and will loop you in when it's done.

Tomas`,
    ),
  },
  {
    id: "cc-not-addressed",
    note: "The question is addressed to Finance; she is copied for awareness.",
    expect: { surface: false },
    signal: email(
      ["Sarah Kwon", "sarah@northwind.example"],
      "Ravi — depot lease accrual question",
      `Ravi,

Quick one for you — for the Antwerp depot, are we accruing the lease uplift from
the signature date or the occupation date? It changes the Q1 number by about
€40k.

Dana copied for visibility.

Sarah`,
      { cc: ["ravi@northwind.example"] },
    ),
  },
  {
    id: "within-authority",
    note: "Below her line and the sender says so; a decision queue that catches this catches everything.",
    expect: { surface: false },
    signal: email(
      ["Jules Adeyemi", "jules@northwind.example"],
      "FYI — team offsite catering",
      `Dana — booking catering for the ops offsite, €2,800, which is well inside my
own sign-off limit so I'm not asking for approval. Just flagging it since you'll
see it in the month-end.

Jules`,
    ),
  },
  {
    id: "resolved-in-thread",
    note: "Two reports raised and settled it themselves while she was copied.",
    expect: { surface: false },
    signal: email(
      ["Ravi Patel", "ravi@northwind.example"],
      "Re: Re: Carrier rate discrepancy",
      `Agreed with Sarah's read — it's a mapping error on their side, not a rate
change. She's raised it with the carrier and they've confirmed. No action for
anyone here, closing this out.

Dana, no need to read the thread above.

Ravi`,
    ),
  },
  {
    id: "automated-invoice",
    note: "Automated billing notice, explicitly no action required.",
    expect: { surface: false },
    signal: email(
      ["Vendor Billing", "no-reply@billing.vendor.example"],
      "Invoice INV-88213 is now available",
      "Your invoice INV-88213 for €4,120.00 is available in your account. No action is required if payment is on autopay.",
    ),
  },
  {
    id: "it-maintenance",
    note: "Infrastructure notice affecting everyone equally; no decision.",
    expect: { surface: false },
    signal: email(
      ["IT Operations", "itops@northwind.example"],
      "Planned maintenance: email unavailable Sunday 02:00-04:00",
      "Scheduled maintenance this Sunday between 02:00 and 04:00 CET. Email and the intranet will be unavailable. No action needed.",
    ),
  },
  {
    id: "all-hands-fyi",
    note: "Broadcast to the whole company with an explicit no-action line.",
    expect: { surface: false },
    signal: email(
      ["Internal Comms", "comms@northwind.example"],
      "All-hands deck is live",
      "Team — the all-hands deck is in the shared drive. No action needed from anyone, just flagging it's there ahead of Thursday.",
      { cc: ["all@northwind.example"] },
    ),
  },
  {
    id: "congratulations",
    note: "Warm note with no ask; surfacing it trains her to skim the queue.",
    expect: { surface: false },
    signal: email(
      ["Helena Ostrom", "helena@ostromcapital.example"],
      "Well done on Rotterdam",
      `Dana — saw the cutover numbers in Priya's update. Genuinely impressive given
where that programme was in October. Well done to you and the team.

Helena`,
    ),
  },
  {
    id: "out-of-office",
    note: "Auto-reply.",
    expect: { surface: false },
    signal: email(
      ["Lars Nilsson", "lars@northwind.example"],
      "Automatic reply: Depot rota",
      "I am out of the office until 16 March with limited access to email. For urgent operational matters please contact the duty manager.",
    ),
  },
  {
    id: "recruiter-spam",
    note: "Unsolicited recruiter outreach.",
    expect: { surface: false },
    signal: email(
      ["Amanda Cole", "amanda@peakexecsearch.example"],
      "Confidential — COO opportunity, PE-backed logistics platform",
      `Dana, I'm working on a confidential COO mandate for a PE-backed platform in
the Benelux. Given your track record I wanted to reach out directly. Would you be
open to a confidential conversation?`,
    ),
  },
  {
    id: "forwarded-article",
    note: "Shared reading with no ask attached.",
    expect: { surface: false },
    signal: email(
      ["Marco Silva", "marco@northwind.example"],
      "Fwd: Interesting piece on port automation",
      "Thought of our Antwerp conversation when I read this. No action, just interesting.",
    ),
  },
  {
    id: "routine-one-to-one",
    note: "Standing recurring 1:1 she organises herself; nothing has changed.",
    expect: { surface: false },
    signal: {
      kind: "meeting",
      occurredAt: hoursAhead(26),
      fromName: "Dana Reyes",
      fromEmail: EXEC,
      participants: [EXEC, "ines@northwind.example"],
      subject: "Dana / Ines 1:1",
      body: "Weekly. Recurring.",
    },
  },
  {
    id: "expense-reminder",
    note: "Automated nudge for a routine action, not a judgement call.",
    expect: { surface: false },
    signal: email(
      ["Expenses", "no-reply@expenses.northwind.example"],
      "Reminder: 2 expense reports awaiting your approval",
      "You have 2 expense reports awaiting approval. Log in to review. This is an automated reminder.",
    ),
  },
  {
    id: "webinar-invite",
    note: "Marketing event invitation with no relationship behind it.",
    expect: { surface: false },
    signal: email(
      ["Freight Insights", "events@freightinsights.example"],
      "Webinar: Navigating 2026 emissions rules",
      "Join our panel of experts on 2 April. Register now — spaces limited.",
    ),
  },
  {
    id: "doc-for-visibility",
    note: "Shared for awareness by its owner, who has already approved it.",
    expect: { surface: false },
    signal: email(
      ["Sarah Kwon", "sarah@northwind.example"],
      "Depot standards doc — final, for visibility",
      `Dana — the depot handling standards doc is final and signed off on my side.
Sharing for visibility only, no review needed. It goes out to site leads Monday.

Sarah`,
    ),
  },
  {
    id: "survey-request",
    note: "Bulk internal survey with no individual consequence.",
    expect: { surface: false },
    signal: email(
      ["People Team", "people@northwind.example"],
      "Engagement survey closes Friday",
      "A reminder that the engagement survey closes Friday. It takes about eight minutes. Responses are anonymous.",
    ),
  },
  {
    id: "vendor-status-page",
    note: "Automated incident notification that has already resolved.",
    expect: { surface: false },
    signal: email(
      ["Status", "status@wms-vendor.example"],
      "[Resolved] Elevated API latency",
      "This incident has been resolved. Between 04:10 and 04:52 CET some customers experienced elevated API latency. A post-incident report will follow.",
    ),
  },
  // ------------------------------------------------------ v2: harder cases
  {
    id: "ask-then-retracted",
    group: "retract",
    note: "A real ask — but the next signal in the batch withdraws it, and triage is meant to read the batch.",
    expect: { surface: false },
    signal: email(
      ["Priya Raman", "priya@northwind.example"],
      "Need a call on the Rotterdam carrier swap",
      `Dana — the secondary carrier wants an answer today on whether we move the
Rotterdam overflow to them from April. It is about €60k a quarter. Can you
give me a yes or no by 5?

Priya`,
      { hoursAgo: 4 },
    ),
  },
  {
    id: "retraction",
    group: "retract",
    note: "The withdrawal itself asks nothing.",
    expect: { surface: false },
    signal: email(
      ["Priya Raman", "priya@northwind.example"],
      "Re: Need a call on the Rotterdam carrier swap",
      `Ignore my last — Sarah had already agreed terms with them on Monday, so
nothing needed from you. Sorry for the noise.

Priya`,
      { hoursAgo: 2 },
    ),
  },
  {
    id: "negative-option-material",
    note: "Phrased as FYI, but a €40k contract change with a default and a deadline is an approval she must see before it fires.",
    expect: { surface: true, category: "approval", urgency: 1 },
    signal: email(
      ["Tomas Bergh", "tomas@northwind.example"],
      "Carrier contract — going ahead Friday unless you object",
      `Dana,

Heads up: I am going to sign the amended carrier contract on Friday — it moves
us to a two-year term at a 6% higher rate in exchange for guaranteed capacity
over peak. Roughly €40k a year.

I think it is clearly right. If you disagree, shout before Friday; otherwise I
will take silence as a yes.

Tomas`,
      { hoursAgo: 18 },
    ),
  },
  {
    id: "report-decided-routine",
    note: "Same phrasing as the case above, but routine and inside the sender's authority — the contrast the prompt has to hold.",
    expect: { surface: false },
    signal: email(
      ["Ines Marchetti", "ines@northwind.example"],
      "Antwerp night shift start moving to 22:00",
      `Dana — FYI, moving the Antwerp night shift start from 21:00 to 22:00 from
next week; the terminal changed its gate hours. Cost-neutral, crews are fine
with it. Shout if you see a problem, otherwise no action.

Ines`,
      { hoursAgo: 22 },
    ),
  },
  {
    id: "hr-complaint",
    note: "A formal complaint against a direct report is never delegable and cannot wait.",
    expect: { surface: true, category: "escalation", urgency: 3 },
    signal: email(
      ["Ola Bakke", "ola@northwind.example"],
      "Confidential — formal complaint received",
      `Dana,

We have received a formal written complaint this morning from a member of the
Antwerp yard team regarding conduct by their site manager, who reports to Ines.
It names a specific incident and there is a witness.

Under the policy I have to open an investigation within 48 hours and I need to
agree with you who leads it, since it cannot be Ines. Can we speak today?

Ola
People Director`,
      { hoursAgo: 3 },
    ),
  },
  {
    id: "subpoena",
    note: "Legal cannot act without an officer naming a records custodian; the clock is statutory.",
    expect: { surface: true, category: "escalation", urgency: 2 },
    signal: email(
      ["Ana Ferreira", "legal@northwind.example"],
      "Subpoena received — need a custodian named by Wednesday",
      `Dana,

We were served this morning with a subpoena for records relating to the
Meridian account over the last 18 months. The response deadline is in 14 days.

I need an officer to designate a records custodian and approve the litigation
hold going out to about forty staff. Both need your name on them, and the hold
has to go out by Wednesday to be defensible.

Ana`,
      { hoursAgo: 6 },
    ),
  },
  {
    id: "journalist",
    note: "Comms can draft, but whether the COO comments on a safety incident is not Comms's call.",
    expect: { surface: true, category: "reply", urgency: 2 },
    signal: email(
      ["Sam Ortiz", "s.ortiz@tradepress.example"],
      "Request for comment — Antwerp incidents — deadline 17:00",
      `Ms Reyes,

I am writing a piece on subcontractor safety at Belgian terminals and
understand there have been two near-misses at Northwind's Antwerp site this
month. I would like to give you the opportunity to comment before we publish.
Deadline is 17:00 today.

Sam Ortiz
Trade Press Europe`,
      { hoursAgo: 5 },
    ),
  },
  {
    id: "partner-announcement",
    note: "An external CEO needs her yes before a public announcement; nobody below her can give it.",
    expect: { surface: true, category: "approval", urgency: 2 },
    signal: email(
      ["Karim Haddad", "karim@portlink.example"],
      "OK to announce Tuesday?",
      `Dana — our comms team wants to put the Northwind–Portlink partnership
release out Tuesday morning. Draft attached, your logo and a quote from you
we have paraphrased from the call. Do we have your OK?

Karim`,
      { hoursAgo: 28 },
    ),
  },
  {
    id: "addressed-to-other-in-to",
    note: "She is in the To line, but the ask is addressed to Sarah by name.",
    expect: { surface: false },
    signal: email(
      ["Ravi Patel", "ravi@northwind.example"],
      "Q2 depot numbers",
      `Sarah — can you pull the Q2 depot utilisation numbers for the finance
pack by Thursday? Same format as Q1.

Thanks,
Ravi`,
      { cc: ["sarah@northwind.example"] },
    ),
  },
  {
    id: "investor-catchup-invite",
    note: "A routine catch-up with nothing to decide or prepare; accepting it is not an executive decision.",
    expect: { surface: false },
    signal: {
      kind: "meeting",
      occurredAt: hoursAhead(6 * 24),
      fromName: "Helena Ostrom",
      fromEmail: "helena@ostromcapital.example",
      participants: ["helena@ostromcapital.example", EXEC],
      subject: "Dana / Helena catch up",
      body: "Quarterly catch up. Coffee, no agenda.",
    },
  },
  {
    id: "reply-all-thanks",
    note: "Reply-all gratitude.",
    expect: { surface: false },
    signal: email(
      ["Jules Adeyemi", "jules@northwind.example"],
      "Re: Re: Offsite logistics",
      "Thanks all — great work getting this sorted so quickly.",
      { cc: ["ops-team@northwind.example"] },
    ),
  },
];
