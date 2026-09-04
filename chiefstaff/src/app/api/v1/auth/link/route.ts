import type { NextRequest } from "next/server";
import { redeemLinkCode } from "@/lib/api-auth";
import { body, error, json } from "@/lib/api";

/** Phone → server: trade the code shown on the web for a bearer token. */
export async function POST(request: NextRequest) {
  const input = await body<{ code?: string; device?: string }>(request);
  if (!input?.code) return error("code required", 400);

  const result = await redeemLinkCode(input.code, input.device ?? "phone");
  if (!result) return error("code is invalid or expired", 400);

  return json({
    token: result.token,
    user: { name: result.user.name, email: result.user.email },
  });
}
