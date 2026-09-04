import type { Brief, User } from "@prisma/client";
import { db } from "@/lib/db";
import { MODEL, write } from "@/lib/claude";
import { localDayStart } from "@/lib/time";
import { openMovements, staleMetrics } from "./metrics";
import { whoToTalkTo } from "./people-signals";

const SYSTEM = `You write the morning brief for a senior executive.

Rules, in order of importance:

1. Ninety seconds to read, on a phone, before the first meeting. Under 400
   words. Depth is one click away; it is never on this page.
2. Every claim traces to something in the material below. Never infer a number,
   a name, a deadline, or a mood that is not there. If you do not know, omit it.
3. Every line answers "so what": a number comes with its comparison and, where
   given, its owner. Nothing appears without a reason it matters.
4. Write like a chief of staff, not a newsletter: plain sentences, no headings
   beyond the five below, no bullets longer than one line, no adjectives doing
   work that facts should do.
5. Name people by name. "Three people are waiting on you" is useless;
   "Marco, Priya and the board chair are waiting on you" is the brief.

Structure — these sections, as markdown h2, in this order. Omit any section
whose material says "(none)"; never write a section to say it is empty,
except "Needs you", which always appears.

## Needs you
The decisions, in priority order. One line each. If none: one sentence.

## What moved
Up to three numbers that left their normal range, as plain sentences with the
comparison basis, exactly as given in the material — do not round further or
add causes that are not stated. If a source is stale, say so in one line.

## Who to talk to
One or two people, each with the reason given. A reason to talk, never a
verdict about the person.

## You're waiting on
Open loops, oldest first, with how long they have been open.

## Today
The meetings that matter and the one thing to know before each. If a meeting
has prep, say "prep ready" after it. Skip routine recurring blocks unless
something about them changed.

Do not add a greeting, a sign-off, or a summary line at the end.`;

function daysOpen(since: Date): number {
  return Math.max(0, Math.floor((Date.now() - since.getTime()) / 86_400_000));
}

/** Generate (or regenerate) today's brief from current decisions, loops, movements, people and calendar. */
export async function generateBrief(user: User): Promise<Brief> {
  const now = new Date();
  const [decisions, loops, meetings, preps, movements, stale, talkTo, yesterday] = await Promise.all([
    db.decision.findMany({
      where: { userId: user.id, status: "open" },
      orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
      take: 15,
      include: { person: true },
    }),
    db.loop.findMany({
      where: { userId: user.id, status: "waiting", direction: "owed_to_me" },
      orderBy: { askedAt: "asc" },
      take: 15,
      include: { person: true },
    }),
    db.signal.findMany({
      where: { userId: user.id, kind: "meeting", occurredAt: { gte: now, lte: new Date(now.getTime() + 86_400_000) } },
      orderBy: { occurredAt: "asc" },
      take: 15,
    }),
    db.meetingPrep.findMany({ where: { userId: user.id, startsAt: { gte: now } }, select: { signalId: true } }),
    openMovements(user.id, 3),
    staleMetrics(user.id),
    whoToTalkTo(user.id, 2),
    db.brief.findFirst({ where: { userId: user.id }, orderBy: { forDate: "desc" } }),
  ]);

  const prepped = new Set(preps.map((prep) => prep.signalId));
  const list = <T>(items: T[], render: (item: T) => string) => (items.length ? items.map(render).join("\n") : "(none)");

  const material = [
    `Executive: ${user.name ?? user.email}${user.role ? `, ${user.role}` : ""}${user.company ? ` at ${user.company}` : ""}.`,
    `Now: ${now.toISOString()} (${user.timezone}).`,
    "",
    "DECISIONS NEEDING THEM:",
    list(decisions, (decision) =>
      `- [urgency ${decision.urgency}] ${decision.title} — ${decision.why} (${decision.category}${decision.person ? `, from ${decision.person.name ?? decision.person.email}` : ""})`,
    ),
    "",
    "WHAT MOVED (already phrased; use as-is):",
    list(movements, (movement) =>
      `- ${movement.sentence}${movement.metric.owner ? ` Owner: ${movement.metric.owner.name ?? movement.metric.owner.email}.` : ""}`,
    ),
    stale.length ? `Stale sources (no data in 14+ days): ${stale.map((metric) => metric.name + (metric.segment ? ` at ${metric.segment}` : "")).join(", ")}.` : "",
    "",
    "WHO TO TALK TO:",
    list(talkTo, (person) => `- ${person.name} — ${person.reasons.join("; ")}`),
    "",
    "OPEN LOOPS (they are waiting on these):",
    list(loops, (loop) =>
      `- ${loop.person?.name ?? loop.person?.email ?? "someone"} owes: ${loop.ask} — asked ${daysOpen(loop.askedAt)} days ago${loop.dueAt ? `, due ${loop.dueAt.toISOString().slice(0, 10)}` : ""}`,
    ),
    "",
    "NEXT 24 HOURS OF CALENDAR:",
    list(meetings, (meeting) =>
      `- ${meeting.occurredAt.toISOString()} ${meeting.subject} (${meeting.participants.length} attendees: ${meeting.participants.slice(0, 8).join(", ")})${prepped.has(meeting.id) ? " [prep ready]" : ""}`,
    ),
    "",
    "YESTERDAY'S BRIEF (for 'what changed' — do not repeat it):",
    yesterday?.markdown ?? "(none)",
  ].join("\n");

  const markdown = await write({ system: SYSTEM, prompt: material, maxTokens: 4000 });

  // The executive's local calendar day, not the server's.
  const forDate = localDayStart(now, user.timezone);
  return db.brief.upsert({
    where: { userId_forDate: { userId: user.id, forDate } },
    create: { userId: user.id, forDate, markdown, model: MODEL },
    update: { markdown, model: MODEL },
  });
}
