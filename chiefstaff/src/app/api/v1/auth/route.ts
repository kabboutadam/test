import type { NextRequest } from "next/server";
import { revokeBearer } from "@/lib/api-auth";
import { json } from "@/lib/api";

/** Sign out: revoke this device's token. */
export async function DELETE(request: NextRequest) {
  const revoked = await revokeBearer(request.headers.get("authorization"));
  return json({ ok: revoked });
}
