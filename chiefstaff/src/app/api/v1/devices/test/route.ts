import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authed, error, json } from "@/lib/api";
import { sendPush } from "@/lib/push";

/** A hello to every phone linked to this account. Proves the push path end to end. */
export async function POST(request: NextRequest) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;

  const devices = await db.device.findMany({ where: { userId: auth.user.id } });
  if (devices.length === 0) return error("no phones have registered for push yet", 409);

  const result = await sendPush(
    devices.map((device) => ({
      to: device.expoPushToken,
      title: "ChiefStaff",
      body: "Push works. Your brief will arrive this way.",
      data: { screen: "brief" },
    })),
  );
  if (result.dead.length) await db.device.deleteMany({ where: { expoPushToken: { in: result.dead } } });
  return json({ sent: result.sent, failed: result.failed });
}
