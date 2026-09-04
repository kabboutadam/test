import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authed, json } from "@/lib/api";

export async function GET(request: NextRequest) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const connections = await db.connection.count({ where: { userId: user.id } });
  return json({
    user: {
      name: user.name,
      email: user.email,
      role: user.role,
      company: user.company,
      timezone: user.timezone,
      briefHour: user.briefHour,
      connected: connections > 0,
    },
  });
}
