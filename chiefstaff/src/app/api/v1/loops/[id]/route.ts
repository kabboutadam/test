import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authed, body, error, json } from "@/lib/api";

const STATUSES = new Set(["answered", "dropped"]);

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const input = await body<{ status?: string }>(request);
  if (!input?.status || !STATUSES.has(input.status)) return error("status must be answered or dropped", 400);

  const { count } = await db.loop.updateMany({
    where: { id, userId: auth.user.id, status: "waiting" },
    data: { status: input.status },
  });
  if (count === 0) return error("not found", 404);
  return json({ ok: true });
}
