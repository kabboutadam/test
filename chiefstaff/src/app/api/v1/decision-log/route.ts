import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authed, body, error, json } from "@/lib/api";
import { hitRates, logDecision } from "@/core/decision-log";

export async function GET(request: NextRequest) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;

  const [records, rates] = await Promise.all([
    db.decisionRecord.findMany({
      where: { userId: auth.user.id },
      orderBy: [{ status: "asc" }, { reviewAt: "asc" }],
      take: 100,
      include: { owner: true, metric: true },
    }),
    hitRates(auth.user.id),
  ]);
  return json({
    records: records.map((record) => ({
      id: record.id,
      title: record.title,
      rationale: record.rationale,
      expected: record.expected,
      category: record.category,
      status: record.status,
      outcome: record.outcome,
      decidedAt: record.decidedAt.toISOString(),
      reviewAt: record.reviewAt.toISOString(),
      reviewRequested: Boolean(record.reviewRequestedAt),
      owner: record.owner ? { name: record.owner.name, email: record.owner.email } : null,
      metric: record.metric ? { name: record.metric.name, expectedValue: record.expectedValue } : null,
    })),
    rates,
  });
}

export async function POST(request: NextRequest) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;

  const input = await body<Record<string, unknown>>(request);
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const expected = typeof input?.expected === "string" ? input.expected.trim() : "";
  if (!title || !expected) return error("title and expected are required", 400);

  const reviewDays = typeof input?.reviewDays === "number" && input.reviewDays > 0 ? input.reviewDays : 60;
  const record = await logDecision(auth.user, {
    title,
    expected,
    rationale: typeof input?.rationale === "string" ? input.rationale : "",
    category: typeof input?.category === "string" ? input.category : "other",
    reviewAt: new Date(Date.now() + reviewDays * 86_400_000),
    ownerEmail: typeof input?.owner === "string" ? input.owner : undefined,
  });
  return json({ id: record.id }, 201);
}
