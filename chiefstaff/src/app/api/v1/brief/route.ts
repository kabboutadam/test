import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { parseBrief } from "@/lib/brief-blocks";
import { authed, json } from "@/lib/api";

/** The latest brief, parsed into blocks so the phone needs no markdown parser. */
export async function GET(request: NextRequest) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;

  const brief = await db.brief.findFirst({
    where: { userId: auth.user.id },
    orderBy: { forDate: "desc" },
  });

  return json({
    brief: brief
      ? {
          id: brief.id,
          forDate: brief.forDate.toISOString().slice(0, 10),
          createdAt: brief.createdAt.toISOString(),
          blocks: parseBrief(brief.markdown),
        }
      : null,
  });
}
