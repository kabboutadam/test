import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authed, json } from "@/lib/api";

export async function GET(request: NextRequest) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;

  const loops = await db.loop.findMany({
    where: { userId: auth.user.id, status: "waiting" },
    orderBy: { askedAt: "asc" },
    include: { person: true, signal: { select: { url: true } } },
  });

  return json({
    loops: loops.map((loop) => ({
      id: loop.id,
      direction: loop.direction,
      ask: loop.ask,
      askedAt: loop.askedAt.toISOString(),
      dueAt: loop.dueAt?.toISOString() ?? null,
      daysOpen: Math.max(0, Math.floor((Date.now() - loop.askedAt.getTime()) / 86_400_000)),
      person: loop.person ? { name: loop.person.name, email: loop.person.email } : null,
      url: loop.signal?.url ?? null,
    })),
  });
}
