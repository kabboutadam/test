import { z } from "zod";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { extractWithUsage, NO_USAGE, type Usage } from "@/lib/claude";

const BATCH_SIZE = 20;

export const CATEGORIES = ["approval", "reply", "escalation", "scheduling", "review"] as const;
export type Category = (typeof CATEGORIES)[number];

const TriagedSignal = z.object({
  signal_index: z.number().int(),
  /** False for the large majority — most mail is not a decision. */
  needs_executive: z.boolean(),
  title: z.string(),
  why: z.string(),
  /** "none" is for needs_executive: false. Forcing a decision category onto a
   *  newsletter is how the model ended up inventing one. */
  category: z.enum([...CATEGORIES, "none"]),
  // Literals rather than min/max: the API enforces enum/const server-side
  // but rejects numeric range constraints, so this is the shape that is
  // actually validated before we see it.
  urgency: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  /** A ready-to-send reply, in the executive's voice. Empty when none applies. */
  draft: z.string(),
});

const TriageResult = z.object({ items: z.array(TriagedSignal) });

export type TriagedItem = z.infer<typeof TriagedSignal>;

/** The minimum a signal must provide to be triaged. Deliberately not a Prisma
 *  row, so the eval harness can drive the classifier without a database. */
export interface TriageCandidate {
  kind: "email" | "meeting";
  occurredAt: Date;
  fromName?: string | null;
  fromEmail?: string | null;
  participants: string[];
  subject: string;
  body: string;
}

export interface ExecutiveContext {
  name: string | null;
  email: string;
  role: string | null;
  company: string | null;
  /** Titles the executive has previously dismissed as "not mine". */
  dismissed?: string[];
}

export const TRIAGE_SYSTEM = `You are the triage layer of an executive's chief-of-staff system.

Your job is to decide which incoming signals genuinely require the executive
personally, and to draft the response for the ones that do.

The bar is high. An executive's inbox is mostly noise, and a decision queue that
surfaces everything is worthless. Mark needs_executive: false for anything that
is FYI, a newsletter, an automated notification, something a direct report should
handle, or a thread where the executive has already replied and nothing new is
being asked of them.

Mark needs_executive: true only when the signal contains an explicit ask,
approval, decision, escalation, or commitment that only this person can give.

Read for the ask, not for the tone. Two failure modes matter equally:

- A polite or buried ask is still an ask. "No rush, whenever you get a chance"
  and a question in the last line of a long FYI both count. Length, softness and
  a cheerful subject line are not evidence that something is unimportant.
- Urgent-sounding language is not an ask. A vendor's "ACTION REQUIRED", a
  deadline that belongs to someone else, and a report narrating a problem they
  are already handling are all noise, however loud.

When a direct report is telling the executive what they have decided and are
asking only to be corrected if wrong, that is FYI — if the matter is routine
and inside their own authority. A "unless you object by Friday" on a material
commitment (a contract, a large sum, a personnel change) is not FYI: it is an
approval with a default, and the executive needs to see it before the default
fires. When they cannot proceed without an answer, that is a decision. The test
is whether work stops, or something irreversible happens, without this person.

Read the batch as a whole. If a later signal withdraws an earlier ask — "ignore
my last, sorted" — the earlier one does not need the executive either.

Categories:
- approval: someone needs a yes/no, a sign-off, or a budget release
- reply: a direct question addressed to the executive
- escalation: a problem that has been raised to them because it is stuck
- scheduling: a meeting request needing their judgment (not a routine invite)
- review: a document or plan explicitly sent for their input
- none: use this, and only this, when needs_executive is false

Urgency: 3 = today, blocking others. 2 = today. 1 = this week. 0 = whenever.
Reserve 3 for things where a day's delay has real cost.

For every item with needs_executive: true, write a draft response the executive
could send as-is: direct, specific, no throat-clearing, no "I hope this finds you
well", matching the brevity of a busy person. If the signal is a meeting rather
than a message, put the preparation the executive needs in the draft field
instead. Never invent facts, numbers, commitments, or names that are not in the
signal — if information is missing, the draft should ask for it.

'why' is one sentence explaining why this reached the executive at all. Write it
for someone who has not read the message.

Return exactly one item per signal, with signal_index matching the index shown.
Include items you are marking needs_executive: false.`;

function render(candidate: TriageCandidate, index: number): string {
  return [
    `[${index}] ${candidate.kind.toUpperCase()} · ${candidate.occurredAt.toISOString()}`,
    `From: ${candidate.fromName ?? "unknown"} <${candidate.fromEmail ?? "unknown"}>`,
    `Participants: ${candidate.participants.join(", ") || "none"}`,
    `Subject: ${candidate.subject}`,
    `Body: ${candidate.body.slice(0, 3_000)}`,
  ].join("\n");
}

export function buildPrompt(exec: ExecutiveContext, candidates: TriageCandidate[], now: Date): string {
  const parts = [
    `Executive: ${exec.name ?? exec.email} (${exec.role ?? "executive"}${exec.company ? ` at ${exec.company}` : ""}).`,
    `Their address: ${exec.email}. Current time: ${now.toISOString()}.`,
  ];

  // Dismissals are the highest-quality label this executive will ever give us.
  if (exec.dismissed?.length) {
    parts.push(
      [
        "This executive has recently dismissed the following as not theirs.",
        "Treat anything of the same shape as noise:",
        ...exec.dismissed.map((title) => `- ${title}`),
      ].join("\n"),
    );
  }

  parts.push("Signals:", "", ...candidates.map(render));
  return parts.join("\n\n");
}

/**
 * The classifier. Pure with respect to our database — it takes candidates and
 * returns verdicts, which is what makes it testable against a fixed corpus.
 *
 * Batched deliberately: an ask reads differently when the model can see the
 * four other threads about the same deal.
 */
export async function classify(
  exec: ExecutiveContext,
  candidates: TriageCandidate[],
  options: { now?: Date; effort?: "low" | "medium" | "high" | "xhigh" | "max" } = {},
): Promise<{ items: TriagedItem[]; usage: Usage }> {
  if (candidates.length === 0) return { items: [], usage: NO_USAGE };

  const { value, usage } = await extractWithUsage({
    schema: TriageResult,
    system: TRIAGE_SYSTEM,
    prompt: buildPrompt(exec, candidates, options.now ?? new Date()),
    effort: options.effort ?? "medium",
  });

  return { items: value.items, usage };
}

/** Recent "not mine" verdicts, fed back into the next classification. */
async function recentDismissals(userId: string, limit = 12): Promise<string[]> {
  const dismissed = await db.decision.findMany({
    where: { userId, status: "dismissed" },
    orderBy: { resolvedAt: "desc" },
    take: limit,
    select: { title: true },
  });
  return dismissed.map((decision) => decision.title);
}

/** Turn unprocessed signals into Decisions. */
export async function triage(user: User): Promise<{ reviewed: number; created: number }> {
  const signals = await db.signal.findMany({
    where: { userId: user.id, processedAt: null },
    orderBy: { occurredAt: "desc" },
    take: BATCH_SIZE,
    include: { from: true },
  });

  if (signals.length === 0) return { reviewed: 0, created: 0 };

  const { items } = await classify(
    {
      name: user.name,
      email: user.email,
      role: user.role,
      company: user.company,
      dismissed: await recentDismissals(user.id),
    },
    signals.map((signal) => ({
      kind: signal.kind === "meeting" ? "meeting" : "email",
      occurredAt: signal.occurredAt,
      fromName: signal.from?.name ?? null,
      fromEmail: signal.from?.email ?? null,
      participants: signal.participants,
      subject: signal.subject,
      body: signal.body ?? signal.snippet,
    })),
  );

  let created = 0;
  for (const item of items) {
    const signal = signals[item.signal_index];
    if (!signal || !item.needs_executive) continue;

    await db.decision.create({
      data: {
        userId: user.id,
        signalId: signal.id,
        personId: signal.fromId,
        title: item.title,
        why: item.why,
        // "none" on a surfaced item is a model inconsistency; "review" is the
        // least wrong bucket and beats dropping something that needs them.
        category: item.category === "none" ? "review" : item.category,
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
