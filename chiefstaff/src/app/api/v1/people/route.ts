import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authed, json } from "@/lib/api";

/** The people the executive deals with, most important first — for delegate and owner pickers. */
export async function GET(request: NextRequest) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;
  const people = await db.person.findMany({
    where: { userId: auth.user.id, importance: { gte: 5 } },
    orderBy: { importance: "desc" },
    take: 40,
    select: { email: true, name: true, relationship: true, importance: true },
  });
  return json({ people });
}
