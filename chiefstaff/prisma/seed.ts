/**
 * Seeds one fictional executive with a complete day, so every screen — web
 * and phone — has something real on it before any account is connected or
 * any model call is paid for. Everything a model would normally write
 * (triage verdicts, drafts, loops, the brief) is written here by hand, in
 * the shape the pipeline produces. Everything deterministic (what moved,
 * decision reviews, meeting prep) is produced by the real code.
 *
 * Idempotent: run it as often as you like.
 */
import { PrismaClient } from "@prisma/client";
import type { RawSignal } from "../src/connectors/types";

const db = new PrismaClient();

const EXEC = "dana@northwind.example";
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);
const hoursAhead = (hours: number) => new Date(Date.now() + hours * 3_600_000);
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

const SIGNALS: RawSignal[] = [
  {
    source: "gmail", externalId: "seed-1", kind: "email", threadKey: "t-atlas",
    subject: "Atlas renewal — need your call on the 12% uplift",
    snippet: "Legal is holding. They will not sign past Friday without your sign-off on pricing.",
    body: `Dana,\n\nAtlas came back on the renewal. They will do three years but want the uplift capped at 12% instead of the 18% in our model. That is roughly $340k less over the term.\n\nSarah's read is that we take it — they are our reference account in the region and a walk-away costs us more in the RFPs we are currently in. I think she is right but this is above my line.\n\nLegal cannot send papers until you say yes. Their counsel goes on leave Friday.\n\n— Marco`,
    url: "https://mail.google.com/mail/u/0/#inbox/seed-1", occurredAt: hoursAgo(14),
    fromEmail: "marco@northwind.example", fromName: "Marco Silva",
    participants: ["marco@northwind.example", EXEC, "sarah@northwind.example"],
  },
  {
    source: "gmail", externalId: "seed-2", kind: "email", threadKey: "t-board",
    subject: "Board packet — Q3 draft for your review",
    snippet: "Attaching the draft. Need comments by Thursday to circulate Friday.",
    body: `Hi Dana,\n\nDraft Q3 board packet attached. The operations section is yours — I have put in placeholder commentary on the Rotterdam delay but it needs your framing, not mine.\n\nWe circulate Friday morning, so I need your comments by end of Thursday.\n\nBest,\nPriya`,
    url: "https://mail.google.com/mail/u/0/#inbox/seed-2", occurredAt: hoursAgo(30),
    fromEmail: "priya@northwind.example", fromName: "Priya Raman", participants: ["priya@northwind.example", EXEC],
  },
  {
    source: "gmail", externalId: "seed-3", kind: "email", threadKey: "t-rotterdam",
    subject: "Re: Rotterdam throughput — where are we",
    snippet: "Still chasing the yard numbers. Should have something to you by Monday.",
    body: `Dana — following up on your note last week asking for the yard utilization numbers broken out by shift. Still chasing the terminal for the raw data. Should have something to you by Monday.\n\n— Tomas`,
    url: "https://mail.google.com/mail/u/0/#inbox/seed-3", occurredAt: hoursAgo(52),
    fromEmail: "tomas@northwind.example", fromName: "Tomas Bergh", participants: ["tomas@northwind.example", EXEC],
  },
  {
    source: "gmail", externalId: "seed-4", kind: "email", threadKey: "t-rotterdam",
    subject: "Rotterdam throughput — where are we",
    snippet: "Tomas, can you get me yard utilization by shift for the last six weeks?",
    body: `Tomas,\n\nCan you get me yard utilization by shift for the last six weeks? I need it before the board packet goes out — so by the 18th at the latest.\n\nDana`,
    url: "https://mail.google.com/mail/u/0/#inbox/seed-4", occurredAt: hoursAgo(200),
    fromEmail: EXEC, fromName: "Dana Reyes", participants: [EXEC, "tomas@northwind.example"],
  },
  {
    source: "gmail", externalId: "seed-5", kind: "email", threadKey: "t-hiring",
    subject: "VP Ops loop — final two candidates",
    snippet: "Both cleared the panel. Need your decision to move to offer.",
    body: `Dana,\n\nBoth finalists cleared the panel. Scores are close — Chen is stronger operationally, Okafor is stronger on the change management piece we flagged as the real risk.\n\nThe panel is split. I do not think more interviews will resolve it, and Chen has a competing offer with a decision date next Wednesday.\n\nCan you take thirty minutes this week to make the call?\n\n— Jules`,
    url: "https://mail.google.com/mail/u/0/#inbox/seed-5", occurredAt: hoursAgo(8),
    fromEmail: "jules@northwind.example", fromName: "Jules Adeyemi", participants: ["jules@northwind.example", EXEC],
  },
  {
    source: "gmail", externalId: "seed-6", kind: "email", threadKey: "t-newsletter",
    subject: "Supply Chain Weekly: 5 trends reshaping freight in 2026",
    snippet: "Your Tuesday briefing on the freight market.",
    body: "This week: capacity tightening in the North Atlantic, three carriers announce rate changes. Unsubscribe.",
    url: "https://mail.google.com/mail/u/0/#inbox/seed-6", occurredAt: hoursAgo(20),
    fromEmail: "newsletter@supplychainweekly.example", fromName: "Supply Chain Weekly", participants: ["newsletter@supplychainweekly.example", EXEC],
  },
  {
    source: "gmail", externalId: "seed-8", kind: "email", threadKey: "t-safety",
    subject: "Escalation: second near-miss at Antwerp this month",
    snippet: "Site lead has stood down the night shift. I need a decision on whether we pause the contract.",
    body: `Dana,\n\nSecond near-miss at Antwerp in three weeks — no injuries, but the same root cause as the 4th: the subcontractor's crews are working past the shift cap.\n\nI have stood down the night shift pending review. The site lead is pushing back hard because it costs them the week.\n\nI am not comfortable restarting until we see their revised rota, but pausing a contracted crew is your call, not mine. Need direction today.\n\n— Ines`,
    url: "https://mail.google.com/mail/u/0/#inbox/seed-8", occurredAt: hoursAgo(4),
    fromEmail: "ines@northwind.example", fromName: "Ines Marchetti", participants: ["ines@northwind.example", EXEC],
  },
  {
    source: "gmail", externalId: "seed-10", kind: "email", threadKey: "t-intro",
    subject: "Intro you offered — still good?",
    snippet: "You mentioned you would connect me with Lena at Meridian. No rush.",
    body: `Dana — great running into you at the summit. You mentioned you would introduce me to Lena at Meridian about the cross-dock pilot. Still good? No rush at all.\n\n— Ravi`,
    url: "https://mail.google.com/mail/u/0/#inbox/seed-10", occurredAt: hoursAgo(70),
    fromEmail: "ravi@meridianpartners.example", fromName: "Ravi Anand", participants: ["ravi@meridianpartners.example", EXEC],
  },
  {
    source: "gcal", externalId: "seed-cal-1", kind: "meeting", threadKey: "cal-atlas",
    subject: "Atlas renewal — pricing decision", snippet: "Conference room 2 · 4 attendees",
    body: "Working session to close out the Atlas renewal terms.", url: "https://calendar.google.com/event?eid=seed-cal-1",
    occurredAt: hoursAhead(5), fromEmail: "marco@northwind.example", fromName: "Marco Silva",
    participants: ["marco@northwind.example", EXEC, "sarah@northwind.example", "legal@northwind.example"],
  },
  {
    source: "gcal", externalId: "seed-cal-2", kind: "meeting", threadKey: "cal-1on1",
    subject: "Dana / Ines 1:1", snippet: "Zoom · 2 attendees", body: "Weekly.",
    url: "https://calendar.google.com/event?eid=seed-cal-2", occurredAt: hoursAhead(22),
    fromEmail: EXEC, fromName: "Dana Reyes", participants: [EXEC, "ines@northwind.example"],
  },
  {
    source: "gcal", externalId: "seed-cal-3", kind: "meeting", threadKey: "cal-tomas",
    subject: "Dana / Tomas 1:1", snippet: "Room 4 · 2 attendees", body: "Fortnightly.",
    url: "https://calendar.google.com/event?eid=seed-cal-3", occurredAt: hoursAhead(3),
    fromEmail: EXEC, fromName: "Dana Reyes", participants: [EXEC, "tomas@northwind.example"],
  },
];

async function main() {
  const user = await db.user.upsert({
    where: { email: EXEC },
    create: { email: EXEC, name: "Dana Reyes", role: "COO", company: "Northwind Logistics", timezone: "Europe/Amsterdam" },
    update: {},
  });

  // Signals go through the real ingest path: same entity resolution as Google.
  const { storeSignals } = await import("../src/core/ingest");
  console.log("signals:", await storeSignals(user, SIGNALS));

  // Meeting times must stay in the future for prep to have anything to do.
  await db.signal.updateMany({ where: { userId: user.id, externalId: "seed-cal-1" }, data: { occurredAt: hoursAhead(5) } });
  await db.signal.updateMany({ where: { userId: user.id, externalId: "seed-cal-2" }, data: { occurredAt: hoursAhead(22) } });
  await db.signal.updateMany({ where: { userId: user.id, externalId: "seed-cal-3" }, data: { occurredAt: hoursAhead(3) } });
  await db.signal.updateMany({ where: { userId: user.id }, data: { processedAt: new Date() } });

  const person = async (email: string) =>
    db.person.findUnique({ where: { userId_email: { userId: user.id, email } } });
  const signal = async (externalId: string) =>
    db.signal.findFirst({ where: { userId: user.id, externalId } });

  // ---- Needs you: what triage would have written for these signals.
  const inbox = [
    { sig: "seed-8", from: "ines@northwind.example", title: "Pause the Antwerp night-shift subcontractor", category: "escalation", urgency: 3,
      why: "Ines has stood down the night shift after a second near-miss and cannot restart a contracted crew without you; the site lead is pushing to resume today.",
      draft: "Ines — hold the stand-down. We don't restart until we've seen their revised rota with the shift cap enforced, in writing. Tell the site lead the cost of the week is theirs. I'll back you if they escalate. Send me the rota the moment it lands." },
    { sig: "seed-1", from: "marco@northwind.example", title: "Approve Atlas renewal at a 12% cap", category: "approval", urgency: 2,
      why: "Legal cannot send papers without your sign-off on pricing and their counsel goes on leave Friday; Marco and Sarah both recommend taking the 12% cap.",
      draft: "Marco — yes to the 12% cap on a three-year term. Sarah's right about the reference-account value. Get papers to legal today so they're out before Friday. Copy me on the final." },
    { sig: "seed-5", from: "jules@northwind.example", title: "Break the VP Ops tie: Chen or Okafor", category: "approval", urgency: 2,
      why: "The panel is split and Chen has a competing offer with a decision next Wednesday; more interviews will not resolve it.",
      draft: "Jules — put thirty minutes in my diary tomorrow morning and bring the two scorecards side by side. I want to see the change-management evidence for Okafor specifically. We decide in that meeting." },
    { sig: "seed-2", from: "priya@northwind.example", title: "Frame the Rotterdam section of the Q3 board packet", category: "review", urgency: 1,
      why: "The operations section needs your framing of the Rotterdam delay; comments are due end of Thursday for Friday circulation.",
      draft: "Priya — I'll have comments back by Thursday lunchtime. Lead the Rotterdam section with the cutover holding at 94% of model, then the carrier gap and the recovery plan. Don't soften the slip; the board will respect the plan more than the spin." },
  ];
  for (const item of inbox) {
    const sig = await signal(item.sig); const who = await person(item.from);
    const exists = await db.decision.findFirst({ where: { userId: user.id, signalId: sig?.id ?? undefined, title: item.title } });
    if (exists) continue;
    await db.decision.create({ data: { userId: user.id, signalId: sig?.id ?? null, personId: who?.id ?? null, title: item.title, why: item.why, category: item.category, urgency: item.urgency, draft: item.draft, draftKind: "email_reply", citations: sig?.url ? [{ label: sig.subject, url: sig.url }] : [] } });
  }
  console.log("inbox items:", await db.decision.count({ where: { userId: user.id, status: "open" } }));

  // ---- Loops, both directions.
  const loops = [
    { who: "tomas@northwind.example", sig: "seed-4", ask: "Yard utilisation by shift, last six weeks", askedAt: daysAgo(8), dueAt: daysAgo(1), direction: "owed_to_me" },
    { who: "tomas@northwind.example", sig: null, ask: "Revised carrier cost model", askedAt: daysAgo(12), dueAt: null, direction: "owed_to_me" },
    { who: "sarah@northwind.example", sig: null, ask: "Antwerp racking utilisation case for Finance", askedAt: daysAgo(4), dueAt: null, direction: "owed_to_me" },
    { who: "ravi@meridianpartners.example", sig: "seed-10", ask: "Introduce Ravi to Lena at Meridian about the cross-dock pilot", askedAt: daysAgo(3), dueAt: null, direction: "owed_by_me" },
    { who: "ines@northwind.example", sig: null, ask: "Send Ines the Antwerp subcontractor rota review", askedAt: daysAgo(2), dueAt: null, direction: "owed_by_me" },
  ];
  for (const loop of loops) {
    const who = await person(loop.who); const sig = loop.sig ? await signal(loop.sig) : null;
    const exists = await db.loop.findFirst({ where: { userId: user.id, ask: loop.ask } });
    if (exists) continue;
    await db.loop.create({ data: { userId: user.id, personId: who?.id ?? null, signalId: sig?.id ?? null, ask: loop.ask, askedAt: loop.askedAt, dueAt: loop.dueAt, direction: loop.direction } });
  }
  console.log("loops:", await db.loop.count({ where: { userId: user.id, status: "waiting" } }));

  // ---- Thirteen weeks of numbers with one real anomaly.
  const { importMetricRows } = await import("../src/core/metrics");
  // Weeks start on Monday; the latest is last week, already complete.
  const today = new Date();
  const monday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - ((today.getUTCDay() + 6) % 7)));
  const week = (n: number) => new Date(monday.getTime() - (13 - n) * 7 * 86_400_000);
  const labour = { Rotterdam: [27.5, 28.1, 27.9, 28.4, 27.7, 28.0, 28.3, 27.8, 28.2, 27.6, 28.1, 27.9, 34.1], Antwerp: [30.2, 29.8, 30.5, 30.1, 29.9, 30.4, 30.0, 30.3, 29.7, 30.2, 30.1, 29.9, 30.3] };
  const onTime = [96.1, 95.8, 96.4, 96.0, 95.9, 96.2, 96.3, 95.7, 96.1, 96.0, 95.8, 96.2, 96.0];
  const arAging = [412, 398, 425, 407, 415, 402, 419, 410, 396, 408, 421, 404, 411];
  const rows = [];
  for (let n = 0; n < 13; n++) {
    for (const [segment, series] of Object.entries(labour)) rows.push({ key: "labour_pct", name: "Labour cost", segment, period: week(n), value: series[n], unit: "%", goodWhen: "down" as const, owner: segment === "Antwerp" ? "ines@northwind.example" : "tomas@northwind.example" });
    rows.push({ key: "on_time_pct", name: "On-time delivery", segment: "", period: week(n), value: onTime[n], unit: "%", goodWhen: "up" as const, owner: "" });
    rows.push({ key: "ar_over_60", name: "AR over 60 days", segment: "", period: week(n), value: arAging[n] * 1000, unit: "€", goodWhen: "down" as const, owner: "sarah@northwind.example" });
  }
  console.log("metrics:", await importMetricRows(user, rows));

  // ---- Twelve complete months of sales plus the month in progress.
  // Northwind is a €50M/yr logistics business: three lines, eight named
  // accounts, a pipeline that is thinner than the targets assume. August
  // missed on freight forwarding; September is pacing slightly under.
  const nowUtc = new Date();
  const monthStart = (back: number) => new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth() - back, 1));
  const lineSeries: Record<string, number[]> = {
    "Contract logistics": [1.92, 1.95, 2.01, 2.08, 1.90, 1.97, 2.04, 2.06, 2.10, 2.12, 2.15, 2.18, 0.86],
    "Freight forwarding": [1.38, 1.41, 1.36, 1.44, 1.30, 1.39, 1.42, 1.45, 1.40, 1.43, 1.41, 1.24, 0.47],
    "Warehousing": [0.78, 0.79, 0.81, 0.80, 0.82, 0.84, 0.85, 0.86, 0.88, 0.89, 0.91, 0.93, 0.37],
  };
  const targetSeries = [4.05, 4.10, 4.15, 4.25, 4.10, 4.20, 4.30, 4.35, 4.40, 4.45, 4.50, 4.55, 4.60, 4.65, 4.70, 4.75];
  const customerSeries: Record<string, number> = {
    "Halvorsen Foods": 0.92, "Brandt Chemicals": 0.61, "Orion Retail Group": 0.48, "Nordsee Seafood": 0.37,
    "Kessler Automotive": 0.33, "Tulipa Flowers": 0.26, "Vega Electronics": 0.22, "Meridian Pharma": 0.18,
    "Aalto Timber": 0.14, "Cobalt Mining Services": 0.11, "Everything else": 0.55,
  };
  const bookings = [1.05, 1.12, 0.98, 1.20, 0.90, 1.08, 1.15, 1.22, 1.10, 1.18, 1.25, 1.14];
  const winRate = [29, 31, 28, 30, 27, 30, 32, 31, 29, 30, 28, 24];
  const grossMargin = [23.8, 23.6, 23.9, 24.1, 23.5, 23.7, 24.0, 24.2, 24.1, 23.9, 23.6, 22.4];
  const avgDeal = [235, 248, 226, 252, 218, 240, 257, 261, 244, 249, 238, 241];
  const sales = [];
  const M = 1_000_000;
  for (let n = 0; n < 13; n++) {
    const period = monthStart(12 - n);
    let total = 0;
    for (const [line, values] of Object.entries(lineSeries)) {
      total += values[n];
      sales.push({ key: "revenue", name: "Revenue", segment: line, period, value: values[n] * M, unit: "€", goodWhen: "up" as const, owner: "marco@northwind.example" });
    }
    sales.push({ key: "revenue", name: "Revenue", segment: "", period, value: total * M, unit: "€", goodWhen: "up" as const, owner: "marco@northwind.example" });
    const wobble = (index: number, seed: number) => 1 + 0.06 * Math.sin(index * 1.7 + seed);
    Object.entries(customerSeries).forEach(([customer, base], index) =>
      sales.push({ key: "customer_revenue", name: "Customer revenue", segment: customer, period, value: base * wobble(n, index) * M * (n === 12 ? 0.4 : 1), unit: "€", goodWhen: "up" as const, owner: "" }),
    );
    if (n < 12) {
      sales.push({ key: "bookings", name: "Bookings", segment: "", period, value: bookings[n] * M, unit: "€", goodWhen: "up" as const, owner: "marco@northwind.example" });
      sales.push({ key: "win_rate", name: "Win rate", segment: "", period, value: winRate[n], unit: "%", goodWhen: "up" as const, owner: "marco@northwind.example" });
      sales.push({ key: "gross_margin", name: "Gross margin", segment: "", period, value: grossMargin[n], unit: "%", goodWhen: "up" as const, owner: "sarah@northwind.example" });
      sales.push({ key: "avg_deal_size", name: "Avg deal size", segment: "", period, value: avgDeal[n] * 1000, unit: "€", goodWhen: "up" as const, owner: "" });
    }
  }
  targetSeries.forEach((value, n) => sales.push({ key: "revenue_target", name: "Revenue target", segment: "", period: monthStart(12 - n), value: value * M, unit: "€", goodWhen: "neutral" as const, owner: "" }));
  const stages: Record<string, number> = { Qualified: 6.2, Proposal: 3.1, Negotiation: 1.9, Verbal: 0.9 };
  for (const [stage, value] of Object.entries(stages))
    sales.push({ key: "pipeline", name: "Pipeline", segment: stage, period: monthStart(0), value: value * M, unit: "€", goodWhen: "up" as const, owner: "marco@northwind.example" });
  console.log("sales:", await importMetricRows(user, sales));

  // ---- Decision log: one closed, one open, one due for review.
  const { logDecision } = await import("../src/core/decision-log");
  if ((await db.decisionRecord.count({ where: { userId: user.id } })) === 0) {
    await logDecision(user, { title: "Move Rotterdam overflow to the secondary carrier", rationale: "Primary carrier capped capacity over peak; secondary offered guaranteed slots at +6%.", expected: "On-time delivery stays above 95% through peak at no more than €40k extra cost", category: "ops", reviewAt: daysAgo(1), ownerEmail: "tomas@northwind.example" });
    await logDecision(user, { title: "Open the Antwerp night shift with a subcontracted crew", rationale: "Own crews could not cover the terminal's new gate hours without overtime above 15%.", expected: "Night-shift labour cost under 31% with zero reportable safety incidents in the first quarter", category: "ops", reviewAt: daysAgo(20), ownerEmail: "ines@northwind.example" });
    await logDecision(user, { title: "Hold headcount flat through Q3", rationale: "Rotterdam integration risk; revisit once throughput stabilises.", expected: "Throughput at 95% of model without adding roles", category: "people", reviewAt: new Date(Date.now() + 40 * 86_400_000), ownerEmail: "priya@northwind.example" });
    await db.decisionRecord.updateMany({ where: { userId: user.id, title: { startsWith: "Move Rotterdam" } }, data: { decidedAt: daysAgo(61) } });
    await db.decisionRecord.updateMany({ where: { userId: user.id, title: { startsWith: "Open the Antwerp" } }, data: { decidedAt: daysAgo(110), status: "mixed", outcome: "Labour cost held at 30.2% but two near-misses; rota compliance is the open issue.", reviewedAt: daysAgo(20) } });
  }

  // ---- The deterministic steps: what moved, reviews due, meeting prep.
  const { runDeterministic } = await import("../src/core/pipeline");
  console.log("deterministic:", JSON.stringify(await runDeterministic(user)));

  // ---- The brief, as the model would have written it from the above.
  const { localDayStart } = await import("../src/lib/time");
  const forDate = localDayStart(new Date(), user.timezone);
  const markdown = `## Needs you today

- **Antwerp** — Ines has stood down the night shift after a second near-miss and can't restart a contracted crew without you. Draft ready.
- **Atlas renewal** — Marco needs your yes on the 12% cap before Friday; legal's counsel is on leave after that.
- **VP Ops** — the panel is split between Chen and Okafor and Chen's other offer closes Wednesday.
- Priya needs your framing of the Rotterdam section by Thursday.

## What moved

- Labour cost at Rotterdam was 34.1% vs a 28.0% norm over the previous 12 periods (up — worse). Owner: Tomas Bergh.

## Who to talk to

- Tomas — two commitments overdue, the oldest 12 days, and labour at Rotterdam just moved. You see him at 1:1 today.

## You're waiting on

- Tomas, revised carrier cost model — 12 days.
- Tomas, yard utilisation by shift — 8 days, due yesterday.
- Sarah, Antwerp racking utilisation case — 4 days.

## Today

- Tomas 1:1 in three hours — prep ready.
- Atlas pricing decision this afternoon with Marco, Sarah and legal. No pre-read circulated.
- Ines 1:1 tomorrow — you owe her the rota review first.`;
  await db.brief.upsert({ where: { userId_forDate: { userId: user.id, forDate } }, create: { userId: user.id, forDate, markdown, model: "seed" }, update: { markdown, model: "seed" } });

  console.log(`\nSeeded ${user.email}. Open http://localhost:3000`);
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => db.$disconnect());
