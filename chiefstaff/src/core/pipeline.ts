import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { syncUser } from "./ingest";
import { triage } from "./triage";
import { trackLoops } from "./loops";
import { detectMovements } from "./metrics";
import { closeDecisionLoops } from "./decision-log";
import { generatePreps } from "./prep";
import { generateBrief } from "./brief";

export interface PipelineResult {
  ingest: { fetched: number; stored: number; skipped: number };
  triage: { reviewed: number; created: number };
  loops: { opened: number; closed: number };
  movements: { checked: number; moved: number };
  reviews: { reviewed: number };
  preps: { meetings: number; prepared: number };
  briefId: string;
}

/** Snoozed items whose time has come go back into the inbox before anything reads it. */
async function wakeSnoozed(userId: string): Promise<void> {
  await db.decision.updateMany({
    where: { userId, status: "snoozed", snoozedUntil: { lte: new Date() } },
    data: { status: "open", snoozedUntil: null },
  });
}

/**
 * The whole product, in order. Each step reads what the previous ones wrote,
 * and the brief reads all of them. Runs on a schedule before the brief hour
 * and on demand from "Sync now".
 */
export async function runPipeline(user: User, options: { brief?: boolean } = {}): Promise<PipelineResult> {
  await wakeSnoozed(user.id);
  const ingest = await syncUser(user);
  const triaged = await triage(user);
  const loops = await trackLoops(user);
  // Deterministic steps: no model call, no cost, always run.
  const movements = await detectMovements(user);
  const reviews = await closeDecisionLoops(user);
  const preps = await generatePreps(user);
  const brief = options.brief === false ? null : await generateBrief(user);

  return { ingest, triage: triaged, loops, movements, reviews, preps, briefId: brief?.id ?? "" };
}

/** The steps that need no model call. Safe to run as often as you like. */
export async function runDeterministic(user: User) {
  await wakeSnoozed(user.id);
  return {
    movements: await detectMovements(user),
    reviews: await closeDecisionLoops(user),
    preps: await generatePreps(user),
  };
}
