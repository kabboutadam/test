import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authed, body, error, json } from "@/lib/api";

/** Register (or refresh) this phone's Expo push token. */
export async function POST(request: NextRequest) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;

  const input = await body<{ expoPushToken?: string; platform?: string }>(request);
  if (!input?.expoPushToken?.startsWith("ExponentPushToken[")) return error("expoPushToken required", 400);

  await db.device.upsert({
    where: { expoPushToken: input.expoPushToken },
    create: { userId: auth.user.id, expoPushToken: input.expoPushToken, platform: input.platform ?? "unknown" },
    // A token can move between accounts if someone signs out and in again.
    update: { userId: auth.user.id, platform: input.platform ?? "unknown", lastSeenAt: new Date() },
  });
  return json({ ok: true });
}
