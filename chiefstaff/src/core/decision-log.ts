import type { User } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * The Decision Log (spec 5.2). A decision is recorded with the expectation
 * behind it and a review date; on that date the loop is closed — by the data
 * where the expectation was measurable, by asking the owner where it wasn't.
 * Over time this is the company's memory of which bets paid off.
 */

export const RECORD_CATEGORIES = ["hiring", "spend", "pricing", "ops", "people", "strategy", "other"] as const;

export interface NewRecord {
  title: string;
  rationale: string;
  expected: string;
  category?: string;
  reviewAt: Date;
  deciderEmail?: string;
  ownerEmail?: string;
  metricId?: string;
  expectedValue?: number;
  fromDecisionId?: string;
}

export async function logDecision(user: User, input: NewRecord) {
  const person = async (email?: string) =>
    email ? db.person.findUnique({ where: { userId_email: { userId: user.id, email: email.toLowerCase() } } }) : null;
  const [decider, owner] = await Promise.all([person(input.deciderEmail), person(input.ownerEmail)]);

  return db.decisionRecord.create({
    data: {
      userId: user.id,
      title: input.title.trim(),
      rationale: input.rationale.trim(),
      expected: input.expected.trim(),
      category: RECORD_CATEGORIES.includes(input.category as (typeof RECORD_CATEGORIES)[number]) ? input.category! : "other",
      reviewAt: input.reviewAt,
      deciderId: decider?.id ?? null,
      ownerId: owner?.id ?? null,
      metricId: input.metricId ?? null,
      expectedValue: input.expectedValue ?? null,
      fromDecisionId: input.fromDecisionId ?? null,
    },
  });
}

export async function recordOutcome(
  userId: string,
  id: string,
  status: "hit" | "miss" | "mixed" | "dropped",
  outcome: string,
): Promise<void> {
  await db.decisionRecord.updateMany({
    where: { id, userId },
    data: { status, outcome: outcome.trim() || null, reviewedAt: new Date() },
  });
}

function daysAgo(date: Date): number {
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 86_400_000));
}

/**
 * Close loops whose review date has arrived. Each becomes one "review" item
 * in the needs-you inbox, exactly once, with the comparison already done
 * where the data allows and a one-line ask to the owner where it doesn't.
 */
export async function closeDecisionLoops(user: User): Promise<{ reviewed: number }> {
  const due = await db.decisionRecord.findMany({
    where: { userId: user.id, status: "open", reviewAt: { lte: new Date() }, reviewRequestedAt: null },
    include: { owner: true, metric: { include: { points: { orderBy: { periodStart: "desc" }, take: 1 } } } },
  });

  for (const record of due) {
    const age = daysAgo(record.decidedAt);
    const ownerName = record.owner?.name ?? record.owner?.email ?? null;

    let tracking = "";
    if (record.metric && record.expectedValue != null && record.metric.points[0]) {
      const latest = record.metric.points[0].value;
      const unit = record.metric.unit;
      const fmt = (value: number) => (unit === "%" ? `${value.toFixed(1)}%` : `${unit}${Math.round(value).toLocaleString("en-US")}`);
      tracking = ` ${record.metric.name} is at ${fmt(latest)} against the ${fmt(record.expectedValue)} you expected.`;
    }

    const why =
      `${age} days ago you decided "${record.title}", expecting: ${record.expected}.` +
      tracking +
      (ownerName ? ` Owner: ${ownerName}.` : "");

    await db.decision.create({
      data: {
        userId: user.id,
        personId: record.ownerId,
        title: `Review: ${record.title}`,
        why,
        category: "review",
        urgency: 1,
        draftKind: ownerName ? "email_reply" : "note",
        draft: ownerName
          ? `${ownerName.split(" ")[0]} — when we decided "${record.title}" we expected ${record.expected}. Where does it actually stand? One line is fine.`
          : `Record the outcome of "${record.title}" in the decision log: hit, miss or mixed, and why.`,
        citations: [],
      },
    });

    await db.decisionRecord.update({ where: { id: record.id }, data: { reviewRequestedAt: new Date() } });
  }
  return { reviewed: due.length };
}

/** Hit rate by category and by decider: the institutional memory, in two tables. */
export async function hitRates(userId: string) {
  const closed = await db.decisionRecord.findMany({
    where: { userId, status: { in: ["hit", "miss", "mixed"] } },
    include: { decider: true },
  });

  const tally = (key: (record: (typeof closed)[number]) => string) => {
    const buckets = new Map<string, { hit: number; miss: number; mixed: number }>();
    for (const record of closed) {
      const name = key(record);
      const bucket = buckets.get(name) ?? { hit: 0, miss: 0, mixed: 0 };
      bucket[record.status as "hit" | "miss" | "mixed"]++;
      buckets.set(name, bucket);
    }
    return [...buckets].map(([name, counts]) => ({
      name,
      ...counts,
      total: counts.hit + counts.miss + counts.mixed,
      rate: (counts.hit + counts.mixed * 0.5) / Math.max(1, counts.hit + counts.miss + counts.mixed),
    }));
  };

  return {
    byCategory: tally((record) => record.category),
    byDecider: tally((record) => record.decider?.name ?? record.decider?.email ?? "you"),
    closed: closed.length,
  };
}
