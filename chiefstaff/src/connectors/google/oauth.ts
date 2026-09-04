import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { Connection } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Read-only everywhere. The product drafts but never sends, so it never asks
 * for send or write scope — that boundary is enforced here, not in the UI.
 */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export function oauthClient(): OAuth2Client {
  return new google.auth.OAuth2(env.googleClientId, env.googleClientSecret, env.googleRedirectUri);
}

export function consentUrl(state: string): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    // Google only returns a refresh token on the first consent unless we force
    // the prompt, and a connection without one dies at the first token expiry.
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state,
    include_granted_scopes: true,
  });
}

/** An authorized client for a stored connection, refreshing and persisting as needed. */
export async function clientFor(connection: Connection): Promise<OAuth2Client> {
  const client = oauthClient();
  client.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    expiry_date: connection.expiresAt.getTime(),
  });

  client.on("tokens", (tokens) => {
    void db.connection.update({
      where: { id: connection.id },
      data: {
        ...(tokens.access_token ? { accessToken: tokens.access_token } : {}),
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        ...(tokens.expiry_date ? { expiresAt: new Date(tokens.expiry_date) } : {}),
      },
    });
  });

  if (connection.expiresAt.getTime() < Date.now() + 60_000) {
    await client.getAccessToken();
  }
  return client;
}
