import type { NextRequest } from "next/server";
import { authed, body, error, json } from "@/lib/api";
import { recordOutcome } from "@/core/decision-log";

const STATUSES = new Set(["hit", "miss", "mixed", "dropped"]);

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const input = await body<{ status?: string; outcome?: string }>(request);
  if (!input?.status || !STATUSES.has(input.status)) return error("status must be hit, miss, mixed or dropped", 400);
  await recordOutcome(auth.user.id, id, input.status as "hit" | "miss" | "mixed" | "dropped", input.outcome ?? "");
  return json({ ok: true });
}
