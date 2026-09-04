"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { enqueuePipeline } from "@/jobs/queue";
import { createLinkCode } from "@/lib/api-auth";

/**
 * Approving records the executive's intent. It deliberately does not send:
 * the product drafts and the human sends, until there is enough trust and
 * enough evaluation to earn anything else. See docs/ARCHITECTURE.md.
 */
export async function resolveDecision(id: string, status: "approved" | "dismissed" | "done") {
  const user = await requireUser();
  await db.decision.updateMany({
    where: { id, userId: user.id },
    data: { status, resolvedAt: new Date() },
  });
  revalidatePath("/inbox");
  revalidatePath("/brief");
}

export async function closeLoop(id: string, status: "answered" | "dropped") {
  const user = await requireUser();
  await db.loop.updateMany({ where: { id, userId: user.id }, data: { status } });
  revalidatePath("/loops");
}

/**
 * Queues a run rather than performing one. A sync is a handful of Claude calls
 * against a whole mailbox; holding a request open for it ties up a web process
 * and dies at whatever timeout sits in front of it.
 */
export async function syncNow() {
  const user = await requireUser();
  await enqueuePipeline(user.id, "manual");
  revalidatePath("/inbox");
  revalidatePath("/brief");
  revalidatePath("/loops");
}

/** Shows a code on the web the phone can type. Ten minutes, single use. */
export async function linkPhone() {
  const user = await requireUser();
  await createLinkCode(user.id);
  revalidatePath("/settings");
}
