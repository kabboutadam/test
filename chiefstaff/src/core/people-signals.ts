import { db } from "@/lib/db";

/**
 * "Who to talk to" (spec 5.1) — one or two people, each with a reason.
 *
 * This is deliberately the conservative subset of the people early-warning
 * feature (5.5, post-MVP): signals derived from commitments and contact
 * cadence only, never from message content, and always phrased as a reason
 * to talk rather than a verdict about the person.
 */

export interface TalkTo {
  name: string;
  email: string;
  reasons: string[];
}

const OVERDUE_AFTER_DAYS = 7;
const QUIET_AFTER_DAYS = 12;

export async function whoToTalkTo(userId: string, limit = 2): Promise<TalkTo[]> {
  const now = Date.now();
  const [loops, reports] = await Promise.all([
    db.loop.findMany({
      where: { userId, status: "waiting", direction: "owed_to_me", personId: { not: null } },
      include: { person: true },
    }),
    db.person.findMany({ where: { userId, relationship: { in: ["report", "peer"] }, importance: { gte: 30 } } }),
  ]);

  const candidates = new Map<string, TalkTo & { score: number }>();
  const add = (person: { email: string; name: string | null }, reason: string, weight: number) => {
    const entry = candidates.get(person.email) ?? { name: person.name ?? person.email, email: person.email, reasons: [], score: 0 };
    entry.reasons.push(reason);
    entry.score += weight;
    candidates.set(person.email, entry);
  };

  // Overdue commitments accumulate per person.
  const overdueBy = new Map<string, { person: { email: string; name: string | null }; count: number; oldest: number }>();
  for (const loop of loops) {
    if (!loop.person) continue;
    const overdue = loop.dueAt ? loop.dueAt.getTime() < now : now - loop.askedAt.getTime() > OVERDUE_AFTER_DAYS * 86_400_000;
    if (!overdue) continue;
    const entry = overdueBy.get(loop.person.email) ?? { person: loop.person, count: 0, oldest: 0 };
    entry.count++;
    entry.oldest = Math.max(entry.oldest, Math.floor((now - loop.askedAt.getTime()) / 86_400_000));
    overdueBy.set(loop.person.email, entry);
  }
  for (const { person, count, oldest } of overdueBy.values()) {
    if (count >= 2) add(person, `${count} commitments overdue, the oldest ${oldest} days`, count * 2);
    else add(person, `one commitment overdue by ${oldest} days`, 1);
  }

  // Someone who matters has gone quiet in both directions.
  for (const person of reports) {
    const last = Math.max(person.lastInbound?.getTime() ?? 0, person.lastOutbound?.getTime() ?? 0);
    if (!last) continue;
    const quietDays = Math.floor((now - last) / 86_400_000);
    if (quietDays >= QUIET_AFTER_DAYS) add(person, `no contact in ${quietDays} days`, 2);
  }

  return [...candidates.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ name, email, reasons }) => ({ name, email, reasons }));
}
