import type { User } from "@prisma/client";
import { syncUser } from "./ingest";
import { triage } from "./triage";
import { trackLoops } from "./loops";
import { generateBrief } from "./brief";

export interface PipelineResult {
  ingest: { fetched: number; stored: number; skipped: number };
  triage: { reviewed: number; created: number };
  loops: { opened: number; closed: number };
  briefId: string;
}

/**
 * The whole product in four steps. Runs on a schedule before the brief hour,
 * and on demand from the Sync button.
 */
export async function runPipeline(user: User, options: { brief?: boolean } = {}): Promise<PipelineResult> {
  const ingest = await syncUser(user);
  const triaged = await triage(user);
  const loops = await trackLoops(user);
  // Ordering matters: the brief reads what the three steps above just wrote.
  const brief = options.brief === false ? null : await generateBrief(user);

  return { ingest, triage: triaged, loops, briefId: brief?.id ?? "" };
}
