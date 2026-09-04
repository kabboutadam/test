import type { Prisma, User } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Meeting prep (spec 5.4), 1:1s first. Everything here is assembled from
 * data already in the system — no model call, so it is deterministic, cheap
 * and never wrong in an interesting way. What a 1:1 needs: what they owe
 * you, what you owe them, numbers in their area that moved, decisions they
 * own that are up for review, and what you last talked about.
 */

export interface PrepSection {
  heading: string;
  lines: string[];
}

const LOOKAHEAD_HOURS = 24;

function daysAgo(date: Date): number {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

/** A 1:1 is a meeting with exactly one other human on it. */
function counterpart(participants: string[], userEmail: string): string | null {
  const others = participants.filter((email) => email !== userEmail.toLowerCase());
  return others.length === 1 ? others[0] : null;
}

async function buildSections(userId: string, personId: string, personLabel: string): Promise<PrepSection[]> {
  const [theyOwe, iOwe, records, movements, recent] = await Promise.all([
    db.loop.findMany({ where: { userId, personId, status: "waiting", direction: "owed_to_me" }, orderBy: { askedAt: "asc" } }),
    db.loop.findMany({ where: { userId, personId, status: "waiting", direction: "owed_by_me" }, orderBy: { askedAt: "asc" } }),
    db.decisionRecord.findMany({
      where: { userId, ownerId: personId, status: "open" },
      orderBy: { reviewAt: "asc" },
      take: 5,
    }),
    db.movement.findMany({
      where: { userId, status: "open", metric: { ownerId: personId } },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    db.signal.findMany({
      where: { userId, kind: "email", OR: [{ fromId: personId }, { participants: { has: personLabel } }] },
      orderBy: { occurredAt: "desc" },
      take: 12,
      select: { subject: true, occurredAt: true },
    }),
  ]);

  const sections: PrepSection[] = [];

  if (theyOwe.length) {
    sections.push({
      heading: "They owe you",
      lines: theyOwe.map((loop) => `${loop.ask} — ${daysAgo(loop.askedAt)}d${loop.dueAt ? `, due ${loop.dueAt.toISOString().slice(0, 10)}` : ""}`),
    });
  }
  if (iOwe.length) {
    sections.push({
      heading: "You owe them",
      lines: iOwe.map((loop) => `${loop.ask} — promised ${daysAgo(loop.askedAt)}d ago`),
    });
  }
  if (movements.length) {
    sections.push({ heading: "Moved in their area", lines: movements.map((movement) => movement.sentence) });
  }
  if (records.length) {
    sections.push({
      heading: "Decisions they own",
      lines: records.map((record) => `${record.title} — review ${record.reviewAt.toISOString().slice(0, 10)}; expected ${record.expected}`),
    });
  }

  // "Last topics": distinct recent subjects, reply prefixes stripped, so a
  // long thread counts once.
  const topics = [...new Set(recent.map((signal) => signal.subject.replace(/^(re|fwd?):\s*/i, "").trim()))].slice(0, 3);
  if (topics.length) sections.push({ heading: "Recent threads", lines: topics });

  if (sections.length === 0) {
    sections.push({ heading: "Nothing outstanding", lines: ["No open loops, moved numbers or pending decisions with them."] });
  }
  return sections;
}

/** Generate (or refresh) prep for every 1:1 in the next day. */
export async function generatePreps(user: User): Promise<{ meetings: number; prepared: number }> {
  const now = new Date();
  const meetings = await db.signal.findMany({
    where: {
      userId: user.id,
      kind: "meeting",
      occurredAt: { gte: now, lte: new Date(now.getTime() + LOOKAHEAD_HOURS * 3_600_000) },
    },
    orderBy: { occurredAt: "asc" },
  });

  let prepared = 0;
  for (const meeting of meetings) {
    const other = counterpart(meeting.participants, user.email);
    if (!other) continue;

    const person = await db.person.findUnique({ where: { userId_email: { userId: user.id, email: other } } });
    if (!person) continue;

    const sections = (await buildSections(user.id, person.id, person.email)) as unknown as Prisma.InputJsonValue;
    await db.meetingPrep.upsert({
      where: { signalId: meeting.id },
      create: {
        userId: user.id,
        signalId: meeting.id,
        personId: person.id,
        startsAt: meeting.occurredAt,
        title: meeting.subject,
        sections,
      },
      update: { startsAt: meeting.occurredAt, title: meeting.subject, sections, generatedAt: new Date() },
    });
    prepared++;
  }
  return { meetings: meetings.length, prepared };
}
