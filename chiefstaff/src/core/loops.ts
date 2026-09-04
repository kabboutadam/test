import { z } from "zod";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { extract } from "@/lib/claude";

const DetectedLoop = z.object({
  /** Address of the person who owes the answer. */
  owed_by: z.string(),
  /** The ask, as the executive would recognize it. */
  ask: z.string(),
  asked_at: z.string(),
  /** ISO date the executive said they needed it, or empty. */
  due_at: z.string(),
  signal_index: z.number().int(),
});

const ClosedLoop = z.object({
  loop_id: z.string(),
  /** answered when a real response arrived; dropped when it's gone stale. */
  resolution: z.enum(["answered", "dropped"]),
});

const LoopResult = z.object({
  opened: z.array(DetectedLoop),
  closed: z.array(ClosedLoop),
});

const SYSTEM = `You track the open loops of an executive: things they asked
someone for that have not come back.

This is the feature they will care about most, because nobody else does it and
they cannot hold it in their head. Be precise.

Open a loop when the executive asked a specific person for something specific —
a number, a document, a decision, an introduction, a status — and no answer is
visible in the signals you can see. Do not open a loop for pleasantries,
rhetorical questions, standing meetings, or things the executive said they would
do themselves.

Close a loop when a later signal shows the person answered it (resolution:
answered), or when it has clearly been overtaken by events and no longer matters
(resolution: dropped). Do not close a loop merely because the person replied
without answering — "will get to this" is not an answer.

due_at should be an ISO 8601 date only when the executive named a deadline.
Otherwise return an empty string. Never invent one.`;

/** Scan recent signals for asks the executive made, and answers that landed. */
export async function trackLoops(user: User): Promise<{ opened: number; closed: number }> {
  const since = new Date(Date.now() - 14 * 86_400_000);

  const signals = await db.signal.findMany({
    where: { userId: user.id, occurredAt: { gte: since } },
    orderBy: { occurredAt: "desc" },
    take: 60,
    include: { from: true },
  });
  if (signals.length === 0) return { opened: 0, closed: 0 };

  const openLoops = await db.loop.findMany({
    where: { userId: user.id, status: "waiting" },
    include: { person: true },
  });

  const prompt = [
    `Executive: ${user.name ?? user.email} <${user.email}>. Now: ${new Date().toISOString()}.`,
    "",
    "Currently open loops:",
    openLoops.length
      ? openLoops
          .map((loop) => `- id=${loop.id} owed_by=${loop.person?.email ?? "?"} asked=${loop.askedAt.toISOString()} ask="${loop.ask}"`)
          .join("\n")
      : "(none)",
    "",
    "Recent signals:",
    "",
    ...signals.map((signal, index) =>
      [
        `[${index}] ${signal.occurredAt.toISOString()} from ${signal.from?.email ?? user.email}`,
        `Subject: ${signal.subject}`,
        `Body: ${(signal.body ?? signal.snippet).slice(0, 1_500)}`,
      ].join("\n"),
    ),
  ].join("\n\n");

  const result = await extract({ schema: LoopResult, system: SYSTEM, prompt, effort: "medium" });

  let opened = 0;
  for (const loop of result.opened) {
    const person = await db.person.findUnique({
      where: { userId_email: { userId: user.id, email: loop.owed_by.toLowerCase() } },
    });

    // Same ask to the same person twice is one loop, not two.
    const duplicate = openLoops.some(
      (existing) => existing.person?.email === loop.owed_by.toLowerCase() && existing.ask === loop.ask,
    );
    if (duplicate) continue;

    const askedAt = new Date(loop.asked_at);
    await db.loop.create({
      data: {
        userId: user.id,
        personId: person?.id ?? null,
        signalId: signals[loop.signal_index]?.id ?? null,
        ask: loop.ask,
        askedAt: Number.isNaN(askedAt.getTime()) ? new Date() : askedAt,
        dueAt: loop.due_at ? new Date(loop.due_at) : null,
      },
    });
    opened++;
  }

  let closed = 0;
  for (const loop of result.closed) {
    const { count } = await db.loop.updateMany({
      where: { id: loop.loop_id, userId: user.id, status: "waiting" },
      data: { status: loop.resolution },
    });
    closed += count;
  }

  return { opened, closed };
}
