import { z } from "zod";
import type { Signal, User } from "@prisma/client";
import { db } from "@/lib/db";
import { extract } from "@/lib/claude";

const BATCH_SIZE = 20;

const TriagedSignal = z.object({
  signal_index: z.number().int(),
  /** False for the large majority — most mail is not a decision. */
  needs_executive: z.boolean(),
  title: z.string(),
  why: z.string(),
  category: z.enum(["approval", "reply", "escalation", "scheduling", "review"]),
  urgency: z.number().int().min(0).max(3),
  /** A ready-to-send reply, in the executive's voice. Empty when none applies. */
  draft: z.string(),
});

const TriageResult = z.object({ items: z.array(TriagedSignal) });

const SYSTEM = `You are the triage layer of an executive's chief-of-staff system.

Your job is to decide which incoming signals genuinely require the executive
personally, and to draft the response for the ones that do.

The bar is high. An executive's inbox is mostly noise, and a decision queue that
surfaces everything is worthless. Mark needs_executive: false for anything that
is FYI, a newsletter, an automated notification, something a direct report should
handle, or a thread where the executive has already replied and nothing new is
being asked of them.

Mark needs_executive: true only when the signal contains an explicit ask,
approval, decision, escalation, or commitment that only this person can give.

Categories:
- approval: someone needs a yes/no, a sign-off, or a budget release
- reply: a direct question addressed to the executive
- escalation: a problem that has been raised to them because it is stuck
- scheduling: a meeting request needing their judgment (not a routine invite)
- review: a document or plan explicitly sent for their input

Urgency: 3 = today, blocking others. 2 = today. 1 = this week. 0 = whenever.
Reserve 3 for things where a day's delay has real cost.

For every item with needs_executive: true, write a draft response the executive
could send as-is: direct, specific, no throat-clearing, no "I hope this finds you
well", matching the brevity of a busy person. If the signal is a meeting rather
than a message, put the preparation the executive needs in the draft field
instead. Never invent facts, numbers, commitments, or names that are not in the
signal — if information is missing, the draft should ask for it.

'why' is one sentence explaining why this reached the executive at all. Write it
for someone who has not read the message.`;

function render(signal: Signal, index: number, senderName: string | null): string {
  return [
    `[${index}] ${signal.kind.toUpperCase()} · ${signal.occurredAt.toISOString()}`,
    `From: ${senderName ?? "unknown"} <${signal.participants[0] ?? "unknown"}>`,
    `Participants: ${signal.participants.join(", ") || "none"}`,
    `Subject: ${signal.subject}`,
    `Body: ${(signal.body ?? signal.snippet).slice(0, 3_000)}`,
  ].join("\n");
}

/**
 * Turn unprocessed signals into Decisions. Runs in batches so one call sees a
 * whole slice of the executive's day — an ask reads differently when you can
 * see the four other threads about the same deal.
 */
export async function triage(user: User): Promise<{ reviewed: number; created: number }> {
  const signals = await db.signal.findMany({
    where: { userId: user.id, processedAt: null },
    orderBy: { occurredAt: "desc" },
    take: BATCH_SIZE,
    include: { from: true },
  });

  if (signals.length === 0) return { reviewed: 0, created: 0 };

  const prompt = [
    `Executive: ${user.name ?? user.email} (${user.role ?? "executive"}${user.company ? ` at ${user.company}` : ""}).`,
    `Their address: ${user.email}. Current time: ${new Date().toISOString()}.`,
    "",
    "Signals:",
    "",
    ...signals.map((signal, index) => render(signal, index, signal.from?.name ?? null)),
  ].join("\n\n");

  const result = await extract({
    schema: TriageResult,
    system: SYSTEM,
    prompt,
    effort: "medium",
  });

  let created = 0;
  for (const item of result.items) {
    const signal = signals[item.signal_index];
    if (!signal || !item.needs_executive) continue;

    await db.decision.create({
      data: {
        userId: user.id,
        signalId: signal.id,
        personId: signal.fromId,
        title: item.title,
        why: item.why,
        category: item.category,
        urgency: item.urgency,
        draft: item.draft || null,
        draftKind: signal.kind === "email" ? "email_reply" : "note",
        citations: signal.url ? [{ label: signal.subject, url: signal.url }] : [],
      },
    });
    created++;
  }

  await db.signal.updateMany({
    where: { id: { in: signals.map((signal) => signal.id) } },
    data: { processedAt: new Date() },
  });

  return { reviewed: signals.length, created };
}
