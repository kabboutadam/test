import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { consentUrl } from "@/connectors/google/oauth";

export async function GET() {
  // CSRF: the state we send must come back, and only we could have set it.
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(consentUrl(state));
}
