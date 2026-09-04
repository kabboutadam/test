import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authed, body, error, json } from "@/lib/api";

const STATUSES = new Set(["approved", "dismissed", "done"]);

/** Records intent. Deliberately does not send anything — see docs/ARCHITECTURE.md. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const input = await body<{ status?: string }>(request);
  if (!input?.status || !STATUSES.has(input.status)) return error("status must be approved, dismissed or done", 400);

  const { count } = await db.decision.updateMany({
    where: { id, userId: auth.user.id, status: "open" },
    data: { status: input.status, resolvedAt: new Date() },
  });
  if (count === 0) return error("not found", 404);
  return json({ ok: true });
}
