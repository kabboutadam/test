import type { NextRequest } from "next/server";
import { hasSources } from "@/core/integrations";
import { authed, json } from "@/lib/api";

export async function GET(request: NextRequest) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const connected = await hasSources(user.id);
  return json({
    user: {
      name: user.name,
      email: user.email,
      role: user.role,
      company: user.company,
      timezone: user.timezone,
      briefHour: user.briefHour,
      connected,
    },
  });
}
