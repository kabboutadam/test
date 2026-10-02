import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSession, currentUser } from "@/lib/session";
import { exchangeCode, graph, MICROSOFT_SCOPES } from "@/connectors/microsoft/oauth";

interface Profile {
  mail?: string | null;
  userPrincipalName?: string | null;
  displayName?: string | null;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");
  const back = (error: string) => NextResponse.redirect(new URL(`/integrations?error=${error}`, url.origin));

  const jar = await cookies();
  const expected = jar.get("microsoft_oauth_state")?.value;
  jar.delete("microsoft_oauth_state");
  if (denied) return back(denied);
  if (!code || !state || state !== expected) return back("oauth_state");

  let tokens;
  try {
    tokens = await exchangeCode(code);
  } catch (error) {
    return back(encodeURIComponent(error instanceof Error ? error.message : "token_exchange"));
  }
  if (!tokens.refreshToken) return back("no_refresh_token");

  const profile = await graph<Profile>(tokens.accessToken, "/me");
  const email = (profile.mail ?? profile.userPrincipalName ?? "").toLowerCase();
  if (!email) return back("no_email");

  // Connecting while signed in attaches the mailbox to this account; a fresh
  // visitor becomes the account, the same way the Google flow works.
  const signedIn = await currentUser();
  const user =
    signedIn ??
    (await db.user.upsert({ where: { email }, create: { email, name: profile.displayName ?? null }, update: { name: profile.displayName ?? undefined } }));

  await db.connection.upsert({
    where: { userId_provider_accountEmail: { userId: user.id, provider: "microsoft", accountEmail: email } },
    create: {
      userId: user.id,
      provider: "microsoft",
      accountEmail: email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scopes: MICROSOFT_SCOPES.join(" "),
    },
    update: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt, cursor: null },
  });

  if (!signedIn) await createSession(user.id);
  return NextResponse.redirect(new URL("/integrations?connected=microsoft", url.origin));
}
