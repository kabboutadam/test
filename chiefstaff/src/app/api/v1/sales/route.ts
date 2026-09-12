import type { NextRequest } from "next/server";
import { authed, json } from "@/lib/api";
import { salesView } from "@/core/sales";

/** The sales view, computed server-side so the phone draws and never sums. */
export async function GET(request: NextRequest) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;
  return json({ sales: await salesView(auth.user.id) });
}
