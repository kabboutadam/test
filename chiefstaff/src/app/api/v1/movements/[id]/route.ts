import type { NextRequest } from "next/server";
import { authed, body, error, json } from "@/lib/api";
import { markMovement } from "@/core/metrics";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const input = await body<{ status?: string }>(request);
  if (input?.status !== "useful" && input?.status !== "not_useful") return error("status must be useful or not_useful", 400);
  await markMovement(auth.user.id, id, input.status);
  return json({ ok: true });
}
