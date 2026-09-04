import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { enqueuePipeline } from "@/jobs/queue";
import { authed, error, json } from "@/lib/api";

export async function POST(request: NextRequest) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;

  const connections = await db.connection.count({ where: { userId: auth.user.id } });
  if (connections === 0) return error("no sources connected — connect Google on the web first", 409);

  const jobId = await enqueuePipeline(auth.user.id, "mobile");
  return json({ queued: true, jobId }, 202);
}
