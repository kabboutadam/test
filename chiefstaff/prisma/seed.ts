/**
 * Seeds one fictional executive with a realistic week of mail and calendar, so
 * the pipeline can be run and judged end-to-end before any Google account is
 * connected. The mix matters: most of these should NOT reach the inbox, and a
 * triage pass that surfaces all twelve is a broken triage pass.
 */
import { PrismaClient } from "@prisma/client";
import type { RawSignal } from "../src/connectors/types";

const db = new PrismaClient();

const EXEC = "dana@northwind.example";
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);
const hoursAhead = (hours: number) => new Date(Date.now() + hours * 3_600_000);

const SIGNALS: RawSignal[] = [
  {
    source: "gmail",
    externalId: "seed-1",
    kind: "email",
    threadKey: "t-atlas",
    subject: "Atlas renewal — need your call on the 12% uplift",
    snippet: "Legal is holding. They will not sign past Friday without your sign-off on pricing.",
    body: `Dana,

Atlas came back on the renewal. They will do three years but want the uplift capped at 12% instead of the 18% in our model. That is roughly $340k less over the term.

Sarah's read is that we take it — they are our reference account in the region and a walk-away costs us more in the RFPs we are currently in. I think she is right but this is above my line.

Legal cannot send papers until you say yes. Their counsel goes on leave Friday.

— Marco`,
    url: "https://mail.google.com/mail/u/0/#inbox/seed-1",
    occurredAt: hoursAgo(14),
    fromEmail: "marco@northwind.example",
    fromName: "Marco Silva",
    participants: ["marco@northwind.example", EXEC, "sarah@northwind.example"],
  },
  {
    source: "gmail",
    externalId: "seed-2",
    kind: "email",
    threadKey: "t-board",
    subject: "Board packet — Q3 draft for your review",
    snippet: "Attaching the draft. Need comments by Thursday to circulate Friday.",
    body: `Hi Dana,

Draft Q3 board packet attached. The operations section is yours — I have put in placeholder commentary on the Rotterdam delay but it needs your framing, not mine.

We circulate Friday morning, so I need your comments by end of Thursday.

Best,
Priya`,
    url: "https://mail.google.com/mail/u/0/#inbox/seed-2",
    occurredAt: hoursAgo(30),
    fromEmail: "priya@northwind.example",
    fromName: "Priya Raman",
    participants: ["priya@northwind.example", EXEC],
  },
  {
    source: "gmail",
    externalId: "seed-3",
    kind: "email",
    threadKey: "t-rotterdam",
    subject: "Re: Rotterdam throughput — where are we",
    snippet: "Still chasing the yard numbers. Should have something to you by Monday.",
    body: `Dana — following up on your note last week asking for the yard utilization numbers broken out by shift. Still chasing the terminal for the raw data. Should have something to you by Monday.

— Tomas`,
    url: "https://mail.google.com/mail/u/0/#inbox/seed-3",
    occurredAt: hoursAgo(52),
    fromEmail: "tomas@northwind.example",
    fromName: "Tomas Bergh",
    participants: ["tomas@northwind.example", EXEC],
  },
  {
    source: "gmail",
    externalId: "seed-4",
    kind: "email",
    threadKey: "t-rotterdam",
    subject: "Rotterdam throughput — where are we",
    snippet: "Tomas, can you get me yard utilization by shift for the last six weeks? Need it before the board packet.",
    body: `Tomas,

Can you get me yard utilization by shift for the last six weeks? I need it before the board packet goes out — so by the 18th at the latest.

Dana`,
    url: "https://mail.google.com/mail/u/0/#inbox/seed-4",
    occurredAt: hoursAgo(200),
    fromEmail: EXEC,
    fromName: "Dana Reyes",
    participants: [EXEC, "tomas@northwind.example"],
  },
  {
    source: "gmail",
    externalId: "seed-5",
    kind: "email",
    threadKey: "t-hiring",
    subject: "VP Ops loop — final two candidates",
    snippet: "Both cleared the panel. Need your decision to move to offer.",
    body: `Dana,

Both finalists cleared the panel. Scores are close — Chen is stronger operationally, Okafor is stronger on the change management piece we flagged as the real risk.

The panel is split. I do not think more interviews will resolve it, and Chen has a competing offer with a decision date next Wednesday.

Can you take thirty minutes this week to make the call?

— Jules`,
    url: "https://mail.google.com/mail/u/0/#inbox/seed-5",
    occurredAt: hoursAgo(8),
    fromEmail: "jules@northwind.example",
    fromName: "Jules Adeyemi",
    participants: ["jules@northwind.example", EXEC],
  },
  {
    source: "gmail",
    externalId: "seed-6",
    kind: "email",
    threadKey: "t-newsletter",
    subject: "Supply Chain Weekly: 5 trends reshaping freight in 2026",
    snippet: "Your Tuesday briefing on the freight market.",
    body: "This week: capacity tightening in the North Atlantic, three carriers announce rate changes, and what the new emissions rules mean for your fleet. Read online. Unsubscribe.",
    url: "https://mail.google.com/mail/u/0/#inbox/seed-6",
    occurredAt: hoursAgo(20),
    fromEmail: "newsletter@supplychainweekly.example",
    fromName: "Supply Chain Weekly",
    participants: ["newsletter@supplychainweekly.example", EXEC],
  },
  {
    source: "gmail",
    externalId: "seed-7",
    kind: "email",
    threadKey: "t-allhands",
    subject: "All-hands deck is live",
    snippet: "FYI — deck is in the shared drive, no action needed.",
    body: "Team — the all-hands deck is in the shared drive. No action needed from anyone, just flagging it is there ahead of Thursday. — Comms",
    url: "https://mail.google.com/mail/u/0/#inbox/seed-7",
    occurredAt: hoursAgo(26),
    fromEmail: "comms@northwind.example",
    fromName: "Internal Comms",
    participants: ["comms@northwind.example", EXEC, "all@northwind.example"],
  },
  {
    source: "gmail",
    externalId: "seed-8",
    kind: "email",
    threadKey: "t-safety",
    subject: "Escalation: second near-miss at Antwerp this month",
    snippet: "Site lead has stood down the night shift. I need a decision on whether we pause the contract.",
    body: `Dana,

Second near-miss at Antwerp in three weeks — no injuries, but the same root cause as the 4th: the subcontractor's crews are working past the shift cap.

I have stood down the night shift pending review. The site lead is pushing back hard because it costs them the week.

I am not comfortable restarting until we see their revised rota, but pausing a contracted crew is your call, not mine. Need direction today.

— Ines`,
    url: "https://mail.google.com/mail/u/0/#inbox/seed-8",
    occurredAt: hoursAgo(4),
    fromEmail: "ines@northwind.example",
    fromName: "Ines Marchetti",
    participants: ["ines@northwind.example", EXEC],
  },
  {
    source: "gmail",
    externalId: "seed-9",
    kind: "email",
    threadKey: "t-invoice",
    subject: "Invoice INV-88213 is now available",
    snippet: "Your monthly invoice is ready to view.",
    body: "Your invoice INV-88213 for $4,120.00 is available in your account. No action is required if payment is on autopay.",
    url: "https://mail.google.com/mail/u/0/#inbox/seed-9",
    occurredAt: hoursAgo(40),
    fromEmail: "no-reply@billing.vendor.example",
    fromName: "Vendor Billing",
    participants: ["no-reply@billing.vendor.example", EXEC],
  },
  {
    source: "gmail",
    externalId: "seed-10",
    kind: "email",
    threadKey: "t-intro",
    subject: "Intro you offered — still good?",
    snippet: "You mentioned you would connect me with Lena at Meridian. No rush.",
    body: `Dana — great running into you at the summit. You mentioned you would introduce me to Lena at Meridian about the cross-dock pilot. Still good? No rush at all.

— Ravi`,
    url: "https://mail.google.com/mail/u/0/#inbox/seed-10",
    occurredAt: hoursAgo(70),
    fromEmail: "ravi@meridianpartners.example",
    fromName: "Ravi Anand",
    participants: ["ravi@meridianpartners.example", EXEC],
  },
  {
    source: "gcal",
    externalId: "seed-cal-1",
    kind: "meeting",
    threadKey: "cal-atlas",
    subject: "Atlas renewal — pricing decision",
    snippet: "Conference room 2 · 4 attendees",
    body: "Working session to close out the Atlas renewal terms.",
    url: "https://calendar.google.com/event?eid=seed-cal-1",
    occurredAt: hoursAhead(5),
    fromEmail: "marco@northwind.example",
    fromName: "Marco Silva",
    participants: ["marco@northwind.example", EXEC, "sarah@northwind.example", "legal@northwind.example"],
  },
  {
    source: "gcal",
    externalId: "seed-cal-2",
    kind: "meeting",
    threadKey: "cal-1on1",
    subject: "Dana / Ines 1:1",
    snippet: "Zoom · 2 attendees",
    body: "Weekly.",
    url: "https://calendar.google.com/event?eid=seed-cal-2",
    occurredAt: hoursAhead(22),
    fromEmail: EXEC,
    fromName: "Dana Reyes",
    participants: [EXEC, "ines@northwind.example"],
  },
];

async function main() {
  const user = await db.user.upsert({
    where: { email: EXEC },
    create: {
      email: EXEC,
      name: "Dana Reyes",
      role: "COO",
      company: "Northwind Logistics",
      timezone: "Europe/Amsterdam",
    },
    update: {},
  });

  // Reuse the real ingest path so seeded data goes through the same entity
  // resolution and filtering as anything from Google.
  const { storeSignals } = await import("../src/core/ingest");
  const result = await storeSignals(user, SIGNALS);
  console.log(`Seeded ${user.email}:`, result);

  // Thirteen weeks of numbers, the shape a controller's Monday spreadsheet
  // has, with one real anomaly: Rotterdam labour spikes in the latest week.
  const { importMetricRows } = await import("../src/core/metrics");
  const week = (n: number) => new Date(Date.UTC(2026, 5, 1 + n * 7));
  const rows = [];
  const labour = { Rotterdam: [27.5, 28.1, 27.9, 28.4, 27.7, 28.0, 28.3, 27.8, 28.2, 27.6, 28.1, 27.9, 34.1], Antwerp: [30.2, 29.8, 30.5, 30.1, 29.9, 30.4, 30.0, 30.3, 29.7, 30.2, 30.1, 29.9, 30.3] };
  const onTime = [96.1, 95.8, 96.4, 96.0, 95.9, 96.2, 96.3, 95.7, 96.1, 96.0, 95.8, 96.2, 96.0];
  const arAging = [412, 398, 425, 407, 415, 402, 419, 410, 396, 408, 421, 404, 411];
  for (let n = 0; n < 13; n++) {
    for (const [segment, series] of Object.entries(labour)) {
      rows.push({ key: "labour_pct", name: "Labour cost", segment, period: week(n), value: series[n], unit: "%", goodWhen: "down" as const, owner: segment === "Antwerp" ? "ines@northwind.example" : "tomas@northwind.example" });
    }
    rows.push({ key: "on_time_pct", name: "On-time delivery", segment: "", period: week(n), value: onTime[n], unit: "%", goodWhen: "up" as const, owner: "" });
    rows.push({ key: "ar_over_60", name: "AR over 60 days", segment: "", period: week(n), value: arAging[n] * 1000, unit: "€", goodWhen: "down" as const, owner: "sarah@northwind.example" });
  }
  console.log("Seeded metrics:", await importMetricRows(user, rows));

  // A decision whose review date has passed, so loop-closing has work to do.
  const { logDecision } = await import("../src/core/decision-log");
  const existing = await db.decisionRecord.count({ where: { userId: user.id } });
  if (existing === 0) {
    await logDecision(user, {
      title: "Move Rotterdam overflow to the secondary carrier",
      rationale: "Primary carrier capped capacity over peak; secondary offered guaranteed slots at +6%.",
      expected: "On-time delivery stays above 95% through peak at no more than €40k extra cost",
      category: "ops",
      reviewAt: new Date(Date.now() - 86_400_000),
      ownerEmail: "tomas@northwind.example",
    });
    await db.decisionRecord.updateMany({ where: { userId: user.id }, data: { decidedAt: new Date(Date.now() - 61 * 86_400_000) } });
    console.log("Seeded a decision due for review");
  }

  console.log("Next: npm run pipeline");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
