"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { runPipeline } from "@/core/pipeline";

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

export async function syncNow() {
  const user = await requireUser();
  await runPipeline(user);
  revalidatePath("/inbox");
  revalidatePath("/brief");
  revalidatePath("/loops");
}
