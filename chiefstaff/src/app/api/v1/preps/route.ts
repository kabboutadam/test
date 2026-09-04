import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authed, json } from "@/lib/api";

export async function GET(request: NextRequest) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;

  const preps = await db.meetingPrep.findMany({
    where: { userId: auth.user.id, startsAt: { gte: new Date(Date.now() - 3_600_000) } },
    orderBy: { startsAt: "asc" },
    take: 20,
    include: { person: true },
  });
  return json({
    preps: preps.map((prep) => ({
      id: prep.id,
      title: prep.title,
      startsAt: prep.startsAt.toISOString(),
      person: prep.person ? { name: prep.person.name, email: prep.person.email } : null,
      sections: prep.sections,
    })),
  });
}
