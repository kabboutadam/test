import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authed, body, error, json } from "@/lib/api";
import { delegate, snooze } from "@/core/inbox";

const RESOLVE = new Set(["approved", "dismissed", "done"]);

/**
 * Records intent. Deliberately does not send anything — see docs/ARCHITECTURE.md.
 * Body: { status: approved|dismissed|done } | { status: snoozed, days } | { status: delegated, to }
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const input = await body<{ status?: string; days?: number; to?: string }>(request);
  if (!input?.status) return error("status required", 400);

  if (input.status === "snoozed") {
    return (await snooze(auth.user.id, id, input.days ?? 1)) ? json({ ok: true }) : error("not found", 404);
  }
  if (input.status === "delegated") {
    if (!input.to) return error("to (email) required", 400);
    const result = await delegate(auth.user.id, id, input.to);
    return result.ok ? json({ ok: true }) : error(result.reason ?? "failed", result.reason === "not found" ? 404 : 400);
  }
  if (!RESOLVE.has(input.status)) return error("status must be approved, dismissed, done, snoozed or delegated", 400);

  const { count } = await db.decision.updateMany({
    where: { id, userId: auth.user.id, status: "open" },
    data: { status: input.status, resolvedAt: new Date() },
  });
  if (count === 0) return error("not found", 404);
  return json({ ok: true });
}
