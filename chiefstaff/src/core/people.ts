import type { Person } from "@prisma/client";
import { db } from "@/lib/db";
import type { RawSignal } from "@/connectors/types";

const BULK_PATTERNS = [
  /^(no-?reply|do-?not-?reply|notifications?|alerts?|support|billing|team|hello|info)@/i,
  /@(mailer|bounce|email|mail|notifications?)\./i,
];

/** Machines don't need the executive. Filtering here keeps them out of triage entirely. */
export function isBulkSender(email: string): boolean {
  return BULK_PATTERNS.some((pattern) => pattern.test(email));
}

function domainOf(email: string): string {
  return email.split("@")[1] ?? "";
}

/**
 * Importance is observed, not configured. Volume gets you noticed, recency keeps
 * you there, and the executive replying to you counts for far more than you
 * emailing them — anyone can email a CEO; getting a reply means something.
 */
export function scoreImportance(person: {
  interactions: number;
  lastInbound: Date | null;
  lastOutbound: Date | null;
}): number {
  const volume = Math.min(40, person.interactions * 2);

  const daysSince = (date: Date | null) =>
    date ? (Date.now() - date.getTime()) / 86_400_000 : Infinity;

  const recency = Math.max(0, 30 - daysSince(person.lastInbound));
  const reciprocity = person.lastOutbound ? Math.max(0, 30 - daysSince(person.lastOutbound)) : 0;

  return Math.round(Math.min(100, volume + recency + reciprocity));
}

/**
 * Find-or-create the people on a signal and update their standing.
 * Returns the sender, which is what triage keys off.
 */
export async function resolvePeople(
  userId: string,
  userEmail: string,
  signal: RawSignal,
): Promise<Person | null> {
  const userDomain = domainOf(userEmail);
  const fromUser = signal.fromEmail?.toLowerCase() === userEmail.toLowerCase();

  for (const email of signal.participants) {
    if (email === userEmail.toLowerCase() || isBulkSender(email)) continue;

    const isSender = email === signal.fromEmail?.toLowerCase();
    const existing = await db.person.findUnique({ where: { userId_email: { userId, email } } });

    const next = {
      interactions: (existing?.interactions ?? 0) + 1,
      // "Inbound" means they reached the executive; "outbound" means the reverse.
      lastInbound: isSender && !fromUser ? signal.occurredAt : existing?.lastInbound ?? null,
      lastOutbound: fromUser ? signal.occurredAt : existing?.lastOutbound ?? null,
    };

    await db.person.upsert({
      where: { userId_email: { userId, email } },
      create: {
        userId,
        email,
        name: isSender ? signal.fromName ?? null : null,
        org: domainOf(email),
        // Same-domain is a colleague until something says otherwise; triage
        // can refine this, but the default is right far more often than not.
        relationship: domainOf(email) === userDomain ? "peer" : "external",
        ...next,
        importance: scoreImportance(next),
      },
      update: {
        ...(isSender && signal.fromName && !existing?.name ? { name: signal.fromName } : {}),
        ...next,
        importance: scoreImportance(next),
      },
    });
  }

  if (!signal.fromEmail || fromUser) return null;
  return db.person.findUnique({ where: { userId_email: { userId, email: signal.fromEmail } } });
}
