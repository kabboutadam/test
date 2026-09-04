"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { enqueuePipeline } from "@/jobs/queue";
import { logDecision, recordOutcome } from "@/core/decision-log";
import { importMetricRows, markMovement, parseMetricsCsv } from "@/core/metrics";
import { runDeterministic } from "@/core/pipeline";
import { delegate, snooze } from "@/core/inbox";
import { createLinkCode } from "@/lib/api-auth";

function refresh() {
  for (const path of ["/inbox", "/brief", "/loops", "/decisions", "/metrics"]) revalidatePath(path);
}

/**
 * Approving records the executive's intent. It deliberately does not send:
 * the product drafts and the human sends, until there is enough trust and
 * enough evaluation to earn anything else. See docs/ARCHITECTURE.md.
 */
export async function resolveDecision(id: string, status: "approved" | "dismissed" | "done") {
  const user = await requireUser();
  await db.decision.updateMany({ where: { id, userId: user.id }, data: { status, resolvedAt: new Date() } });
  refresh();
}

/** Hide it until a date; the pipeline reopens it then. */
export async function snoozeDecision(id: string, days: number) {
  const user = await requireUser();
  await snooze(user.id, id, days);
  refresh();
}

/** Delegating opens a loop: the executive is now waiting on that person. */
export async function delegateDecision(id: string, toEmail: string) {
  const user = await requireUser();
  await delegate(user.id, id, toEmail);
  refresh();
}

export async function closeLoop(id: string, status: "answered" | "dropped") {
  const user = await requireUser();
  await db.loop.updateMany({ where: { id, userId: user.id }, data: { status } });
  refresh();
}

/** Queues a run rather than performing one; see docs/ARCHITECTURE.md. */
export async function syncNow() {
  const user = await requireUser();
  await enqueuePipeline(user.id, "manual");
  refresh();
}

// --------------------------------------------------------- decision log

export async function logDecisionAction(formData: FormData) {
  const user = await requireUser();
  const reviewDays = Number(formData.get("reviewDays") ?? 60);
  await logDecision(user, {
    title: String(formData.get("title") ?? ""),
    rationale: String(formData.get("rationale") ?? ""),
    expected: String(formData.get("expected") ?? ""),
    category: String(formData.get("category") ?? "other"),
    reviewAt: new Date(Date.now() + Math.max(1, reviewDays) * 86_400_000),
    ownerEmail: String(formData.get("owner") ?? "") || undefined,
    metricId: String(formData.get("metricId") ?? "") || undefined,
    expectedValue: formData.get("expectedValue") ? Number(formData.get("expectedValue")) : undefined,
    fromDecisionId: String(formData.get("fromDecisionId") ?? "") || undefined,
  });
  refresh();
}

export async function recordOutcomeAction(formData: FormData) {
  const user = await requireUser();
  const status = String(formData.get("status")) as "hit" | "miss" | "mixed" | "dropped";
  if (!["hit", "miss", "mixed", "dropped"].includes(status)) return;
  await recordOutcome(user.id, String(formData.get("id")), status, String(formData.get("outcome") ?? ""));
  refresh();
}

// ---------------------------------------------------------------- metrics

export async function importMetricsAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File)) return;
  const { rows, errors } = parseMetricsCsv(await file.text());
  if (errors.length) console.warn("metrics import:", errors.join("; "));
  if (rows.length) {
    await importMetricRows(user, rows);
    // New numbers may have moved; say so now rather than at the next brief.
    await runDeterministic(user);
  }
  refresh();
}

export async function markMovementAction(id: string, status: "useful" | "not_useful") {
  const user = await requireUser();
  await markMovement(user.id, id, status);
  refresh();
}

// ------------------------------------------------------------ phone link

/** Mint a short-lived code the phone can type. Shown once on the settings page. */
export async function linkPhone() {
  const user = await requireUser();
  await createLinkCode(user.id);
  revalidatePath("/settings");
}
