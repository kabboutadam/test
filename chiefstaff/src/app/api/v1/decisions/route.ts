import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authed, json } from "@/lib/api";

export async function GET(request: NextRequest) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;

  const decisions = await db.decision.findMany({
    where: { userId: auth.user.id, status: "open" },
    orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
    include: { person: true },
  });

  return json({
    decisions: decisions.map((decision) => ({
      id: decision.id,
      title: decision.title,
      why: decision.why,
      category: decision.category,
      urgency: decision.urgency,
      draft: decision.draft,
      draftKind: decision.draftKind,
      person: decision.person ? { name: decision.person.name, email: decision.person.email } : null,
      citations: decision.citations,
      createdAt: decision.createdAt.toISOString(),
    })),
  });
}
