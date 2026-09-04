import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authed, error, json } from "@/lib/api";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const prep = await db.meetingPrep.findFirst({ where: { id, userId: auth.user.id }, include: { person: true } });
  if (!prep) return error("not found", 404);
  return json({
    prep: {
      id: prep.id,
      title: prep.title,
      startsAt: prep.startsAt.toISOString(),
      person: prep.person ? { name: prep.person.name, email: prep.person.email } : null,
      sections: prep.sections,
    },
  });
}
