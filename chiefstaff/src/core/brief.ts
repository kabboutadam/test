import type { Brief, User } from "@prisma/client";
import { db } from "@/lib/db";
import { MODEL, write } from "@/lib/claude";
import { localDayStart } from "@/lib/time";

const SYSTEM = `You write the morning brief for a senior executive.

Rules, in order of importance:

1. Under 400 words. They read this on a phone before their first meeting.
2. Every claim traces to something in the material below. Never infer a number,
   a name, a deadline, or a mood that is not there. If you do not know, omit it.
3. Lead with what changed and what is at risk, not with a schedule dump.
4. Write like a chief of staff, not a newsletter: plain sentences, no headings
   beyond the three below, no bullets longer than one line, no adjectives doing
   work that facts should do.
5. Name people by name. "Three people are waiting on you" is useless;
   "Marco, Priya and the board chair are waiting on you" is the brief.

Structure — exactly these three sections, as markdown h2:

## Needs you today
The decisions, in priority order. One line each. If there are none, say so in
one sentence and move on.

## You're waiting on
Open loops, oldest first, with how long they have been open. If none, omit the
section entirely.

## Today
The meetings that matter and the one thing to know before each. Skip routine
recurring blocks unless something about them changed.

Do not add a greeting, a sign-off, or a summary line at the end.`;

function daysOpen(since: Date): number {
  return Math.max(0, Math.floor((Date.now() - since.getTime()) / 86_400_000));
}

/** Generate (or regenerate) today's brief from current decisions, loops and calendar. */
export async function generateBrief(user: User): Promise<Brief> {
  const [decisions, loops, meetings, yesterday] = await Promise.all([
    db.decision.findMany({
      where: { userId: user.id, status: "open" },
      orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
      take: 15,
      include: { person: true },
    }),
    db.loop.findMany({
      where: { userId: user.id, status: "waiting" },
      orderBy: { askedAt: "asc" },
      take: 15,
      include: { person: true },
    }),
    db.signal.findMany({
      where: {
        userId: user.id,
        kind: "meeting",
        occurredAt: { gte: new Date(), lte: new Date(Date.now() + 86_400_000) },
      },
      orderBy: { occurredAt: "asc" },
      take: 15,
    }),
    db.brief.findFirst({
      where: { userId: user.id },
      orderBy: { forDate: "desc" },
    }),
  ]);

  const material = [
    `Executive: ${user.name ?? user.email}${user.role ? `, ${user.role}` : ""}${user.company ? ` at ${user.company}` : ""}.`,
    `Now: ${new Date().toISOString()} (${user.timezone}).`,
    "",
    "DECISIONS NEEDING THEM:",
    decisions.length
      ? decisions
          .map(
            (decision) =>
              `- [urgency ${decision.urgency}] ${decision.title} — ${decision.why} (${decision.category}${decision.person ? `, from ${decision.person.name ?? decision.person.email}` : ""})`,
          )
          .join("\n")
      : "(none)",
    "",
    "OPEN LOOPS (they are waiting on these):",
    loops.length
      ? loops
          .map(
            (loop) =>
              `- ${loop.person?.name ?? loop.person?.email ?? "someone"} owes: ${loop.ask} — asked ${daysOpen(loop.askedAt)} days ago${loop.dueAt ? `, due ${loop.dueAt.toISOString().slice(0, 10)}` : ""}`,
          )
          .join("\n")
      : "(none)",
    "",
    "NEXT 24 HOURS OF CALENDAR:",
    meetings.length
      ? meetings
          .map(
            (meeting) =>
              `- ${meeting.occurredAt.toISOString()} ${meeting.subject} (${meeting.participants.length} attendees: ${meeting.participants.slice(0, 8).join(", ")})`,
          )
          .join("\n")
      : "(none)",
    "",
    "YESTERDAY'S BRIEF (for 'what changed' — do not repeat it):",
    yesterday?.markdown ?? "(none)",
  ].join("\n");

  const markdown = await write({ system: SYSTEM, prompt: material, maxTokens: 4000 });

  // The executive's local calendar day, not the server's. Filing an Auckland
  // brief under the UTC date puts Tuesday's brief on Monday.
  const forDate = localDayStart(new Date(), user.timezone);
  return db.brief.upsert({
    where: { userId_forDate: { userId: user.id, forDate } },
    create: { userId: user.id, forDate, markdown, model: MODEL },
    update: { markdown, model: MODEL },
  });
}
