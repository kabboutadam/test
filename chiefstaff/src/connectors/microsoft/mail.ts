import type { Connection } from "@prisma/client";
import type { RawSignal } from "../types";
import { accessTokenFor, graph } from "./oauth";

/**
 * Outlook inbox through Microsoft Graph. The first sync reads the last week;
 * after that a delta link carries only what changed, the same shape as the
 * Gmail history cursor.
 */
export interface OutlookMessage {
  id: string;
  subject?: string | null;
  bodyPreview?: string | null;
  body?: { contentType?: string; content?: string } | null;
  from?: { emailAddress?: { address?: string; name?: string } } | null;
  toRecipients?: { emailAddress?: { address?: string; name?: string } }[];
  ccRecipients?: { emailAddress?: { address?: string; name?: string } }[];
  receivedDateTime?: string;
  conversationId?: string | null;
  webLink?: string | null;
  isDraft?: boolean;
  "@removed"?: unknown;
}

interface Page {
  value: OutlookMessage[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

export interface OutlookFetch {
  signals: RawSignal[];
  cursor: string | null;
}

const BACKFILL_DAYS = 7;
const SELECT = "id,subject,bodyPreview,body,from,toRecipients,ccRecipients,receivedDateTime,conversationId,webLink,isDraft";

function strip(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function toSignal(message: OutlookMessage): RawSignal | null {
  if (!message.id || message["@removed"] || message.isDraft) return null;
  const from = message.from?.emailAddress;
  const everyone = [message.from, ...(message.toRecipients ?? []), ...(message.ccRecipients ?? [])]
    .map((recipient) => recipient?.emailAddress?.address?.toLowerCase())
    .filter((address): address is string => Boolean(address));
  const content = message.body?.content ?? "";
  const text = message.body?.contentType?.toLowerCase() === "html" ? strip(content) : content.replace(/\s+/g, " ").trim();
  return {
    source: "outlook",
    externalId: message.id,
    kind: "email",
    threadKey: message.conversationId ?? undefined,
    subject: message.subject || "(no subject)",
    snippet: (message.bodyPreview ?? text).slice(0, 200),
    body: text.slice(0, 12_000),
    url: message.webLink ?? undefined,
    occurredAt: message.receivedDateTime ? new Date(message.receivedDateTime) : new Date(),
    fromEmail: from?.address?.toLowerCase(),
    fromName: from?.name || undefined,
    participants: [...new Set(everyone)],
  };
}

export async function fetchOutlook(connection: Connection): Promise<OutlookFetch> {
  const token = await accessTokenFor(connection);
  const since = new Date(Date.now() - BACKFILL_DAYS * 86_400_000).toISOString();
  let url =
    connection.cursor ??
    `/me/mailFolders/inbox/messages/delta?$select=${SELECT}&$filter=receivedDateTime ge ${since}&$top=50`;
  const signals: RawSignal[] = [];
  let cursor: string | null = connection.cursor;

  for (let page = 0; page < 20; page++) {
    const data: Page = await graph<Page>(token, url, { Prefer: 'outlook.body-content-type="text"' });
    for (const message of data.value ?? []) {
      const signal = toSignal(message);
      if (signal) signals.push(signal);
    }
    if (data["@odata.nextLink"]) {
      url = data["@odata.nextLink"];
      continue;
    }
    cursor = data["@odata.deltaLink"] ?? cursor;
    break;
  }
  return { signals, cursor };
}
