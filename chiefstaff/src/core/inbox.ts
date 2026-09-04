import { db } from "@/lib/db";

/**
 * Inbox actions the web and the phone share. Approve/dismiss record intent;
 * snooze hides until a date; delegate opens a loop so the item stays on the
 * ledger as something the executive is now waiting on.
 */

export async function snooze(userId: string, id: string, days: number): Promise<boolean> {
  const until = new Date(Date.now() + Math.max(1, Math.min(90, days)) * 86_400_000);
  const { count } = await db.decision.updateMany({
    where: { id, userId, status: "open" },
    data: { status: "snoozed", snoozedUntil: until },
  });
  return count > 0;
}

export async function delegate(userId: string, id: string, toEmail: string): Promise<{ ok: boolean; reason?: string }> {
  const decision = await db.decision.findFirst({ where: { id, userId, status: "open" } });
  if (!decision) return { ok: false, reason: "not found" };
  const person = await db.person.findUnique({ where: { userId_email: { userId, email: toEmail.toLowerCase() } } });
  if (!person) return { ok: false, reason: "unknown person" };

  await db.$transaction([
    db.decision.update({ where: { id }, data: { status: "delegated", delegatedToId: person.id, resolvedAt: new Date() } }),
    db.loop.create({
      data: { userId, personId: person.id, signalId: decision.signalId, ask: decision.title, askedAt: new Date(), direction: "owed_to_me" },
    }),
  ]);
  return { ok: true };
}
