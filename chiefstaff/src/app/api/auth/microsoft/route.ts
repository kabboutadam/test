import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { consentUrl } from "@/connectors/microsoft/oauth";
import { microsoftConfigured } from "@/lib/env";

export async function GET(request: Request) {
  if (!microsoftConfigured()) {
    return NextResponse.redirect(new URL("/integrations?error=microsoft_not_configured", new URL(request.url).origin));
  }
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("microsoft_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(consentUrl(state));
}
