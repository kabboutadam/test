import type { Connection } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Microsoft identity platform, personal and work accounts alike ("common").
 * Read-only scopes only: the product drafts, a human sends. Plain fetch; the
 * Graph API is small enough that an SDK would be more surface than help.
 */
export const MICROSOFT_SCOPES = ["openid", "email", "profile", "offline_access", "User.Read", "Mail.Read", "Calendars.Read"];

const AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0";
export const GRAPH = "https://graph.microsoft.com/v1.0";

export function consentUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.microsoftClientId,
    response_type: "code",
    redirect_uri: env.microsoftRedirectUri,
    response_mode: "query",
    scope: MICROSOFT_SCOPES.join(" "),
    state,
    prompt: "select_account",
  });
  return `${AUTHORITY}/authorize?${params}`;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}

async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const response = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.microsoftClientId, client_secret: env.microsoftClientSecret, ...body }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await response.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error_description ?? data.error ?? `token request failed (${response.status})`);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
  };
}

export function exchangeCode(code: string): Promise<Tokens> {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: env.microsoftRedirectUri, scope: MICROSOFT_SCOPES.join(" ") });
}

/** A live access token for a stored connection, refreshing and persisting as needed. */
export async function accessTokenFor(connection: Connection): Promise<string> {
  if (connection.expiresAt.getTime() > Date.now() + 60_000) return connection.accessToken;
  const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: connection.refreshToken, scope: MICROSOFT_SCOPES.join(" ") });
  await db.connection.update({
    where: { id: connection.id },
    data: { accessToken: tokens.accessToken, expiresAt: tokens.expiresAt, ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}) },
  });
  return tokens.accessToken;
}

export async function graph<T>(token: string, url: string, headers: Record<string, string> = {}): Promise<T> {
  const response = await fetch(url.startsWith("http") ? url : `${GRAPH}${url}`, {
    headers: { authorization: `Bearer ${token}`, ...headers },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Microsoft Graph ${response.status}: ${text.slice(0, 200)}`);
  }
  return (await response.json()) as T;
}
