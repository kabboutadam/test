import { google } from "googleapis";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { GOOGLE_SCOPES, oauthClient } from "@/connectors/google/oauth";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const expectedState = jar.get("google_oauth_state")?.value;
  jar.delete("google_oauth_state");

  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(new URL("/settings?error=oauth_state", url.origin));
  }

  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const { data: profile } = await google.oauth2({ version: "v2", auth: client }).userinfo.get();
  if (!profile.email) {
    return NextResponse.redirect(new URL("/settings?error=no_email", url.origin));
  }

  const email = profile.email.toLowerCase();
  const user = await db.user.upsert({
    where: { email },
    create: { email, name: profile.name ?? null },
    update: { name: profile.name ?? undefined },
  });

  if (!tokens.refresh_token) {
    // Without one we cannot sync tomorrow. Google only re-issues on a forced
    // consent, so send them back through it rather than storing a dead grant.
    return NextResponse.redirect(new URL("/settings?error=no_refresh_token", url.origin));
  }

  await db.connection.upsert({
    where: { userId_provider_accountEmail: { userId: user.id, provider: "google", accountEmail: email } },
    create: {
      userId: user.id,
      provider: "google",
      accountEmail: email,
      accessToken: tokens.access_token ?? "",
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3_600_000),
      scopes: GOOGLE_SCOPES.join(" "),
    },
    update: {
      accessToken: tokens.access_token ?? "",
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3_600_000),
    },
  });

  await createSession(user.id);
  return NextResponse.redirect(new URL("/settings", url.origin));
}
