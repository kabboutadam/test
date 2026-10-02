import type { NextRequest } from "next/server";
import { authed, json } from "@/lib/api";
import { listIntegrations } from "@/core/integrations";

/** What is connected, for the phone's settings screen. Never includes secrets. */
export async function GET(request: NextRequest) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;
  return json({ integrations: await listIntegrations(auth.user.id) });
}
