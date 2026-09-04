import { google, type gmail_v1 } from "googleapis";
import type { Connection } from "@prisma/client";
import { clientFor } from "./oauth";
import type { RawSignal } from "../types";

/** Bounded so a first sync on a 200k-message mailbox doesn't run for an hour. */
const BACKFILL_LIMIT = 150;
/** A quiet night adds a handful of messages; a burst is still bounded. */
const INCREMENTAL_LIMIT = 300;

/** Labels whose messages never need an executive. SENT is deliberately absent —
 *  the executive's own outbound is how open loops are detected. */
const EXCLUDED_LABELS = new Set([
  "SPAM",
  "TRASH",
  "DRAFT",
  "CHAT",
  "CATEGORY_PROMOTIONS",
  "CATEGORY_SOCIAL",
]);

export interface GmailFetch {
  signals: RawSignal[];
  /** Gmail historyId to resume from next time. */
  cursor: string | null;
}

interface Address {
  email: string;
  name?: string;
}

/** Parses `Dana Reyes <dana@co.com>, ops@co.com` into addresses. */
function parseAddresses(header: string | undefined): Address[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.*?)\s*<([^>]+)>$/);
      if (match) {
        return { email: match[2].toLowerCase(), name: match[1].replace(/^"|"$/g, "").trim() || undefined };
      }
      return { email: part.toLowerCase() };
    })
    .filter((address) => address.email.includes("@"));
}

function header(message: gmail_v1.Schema$Message, name: string): string | undefined {
  return message.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined;
}

/** Walks the MIME tree for the best text representation. */
function extractBody(part: gmail_v1.Schema$MessagePart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  }
  for (const child of part.parts ?? []) {
    const found = extractBody(child);
    if (found) return found;
  }
  // Fall back to HTML with tags stripped rather than returning nothing.
  if (part.mimeType === "text/html" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url")
      .toString("utf8")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
  }
  return "";
}

function toSignal(message: gmail_v1.Schema$Message): RawSignal | null {
  if (!message.id) return null;
  if ((message.labelIds ?? []).some((label) => EXCLUDED_LABELS.has(label))) return null;

  const from = parseAddresses(header(message, "From"))[0];
  const participants = [
    ...parseAddresses(header(message, "From")),
    ...parseAddresses(header(message, "To")),
    ...parseAddresses(header(message, "Cc")),
  ].map((address) => address.email);

  return {
    source: "gmail",
    externalId: message.id,
    kind: "email",
    threadKey: message.threadId ?? undefined,
    subject: header(message, "Subject") ?? "(no subject)",
    snippet: message.snippet ?? "",
    // Long threads add cost without adding signal; the tail is the ask.
    body: extractBody(message.payload).slice(0, 12_000),
    url: `https://mail.google.com/mail/u/0/#inbox/${message.threadId}`,
    occurredAt: new Date(Number(message.internalDate ?? Date.now())),
    fromEmail: from?.email,
    fromName: from?.name,
    participants: [...new Set(participants)],
  };
}

async function hydrate(gmail: gmail_v1.Gmail, ids: string[]): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  for (const id of ids) {
    try {
      const { data } = await gmail.users.messages.get({ userId: "me", id, format: "full" });
      const signal = toSignal(data);
      if (signal) signals.push(signal);
    } catch (error) {
      // A message deleted between listing and fetching is normal, not fatal.
      if (statusOf(error) !== 404) throw error;
    }
  }
  return signals;
}

function statusOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { code?: unknown; status?: unknown };
  const value = typeof candidate.code === "number" ? candidate.code : candidate.status;
  return typeof value === "number" ? value : undefined;
}

/** First sync for a connection: a bounded recent window. */
async function backfill(gmail: gmail_v1.Gmail): Promise<GmailFetch> {
  // Read the watermark BEFORE listing. Anything that lands mid-backfill is then
  // re-seen on the next incremental pass and deduped on (user, source, id) —
  // whereas reading it afterwards would skip those messages forever.
  const { data: profile } = await gmail.users.getProfile({ userId: "me" });

  const { data: list } = await gmail.users.messages.list({
    userId: "me",
    maxResults: BACKFILL_LIMIT,
    q: "newer_than:7d -category:promotions -category:social -in:chats",
  });

  const ids = (list.messages ?? []).map((stub) => stub.id).filter((id): id is string => Boolean(id));
  return { signals: await hydrate(gmail, ids), cursor: profile.historyId ?? null };
}

/**
 * Everything added since the last sync. This is the common path and it is
 * usually one API call returning nothing — as against the 150 the backfill
 * costs, which is what re-listing on every run used to do.
 */
async function incremental(gmail: gmail_v1.Gmail, startHistoryId: string): Promise<GmailFetch> {
  const ids = new Set<string>();
  let cursor: string | null = startHistoryId;
  let pageToken: string | undefined;

  do {
    const { data }: { data: gmail_v1.Schema$ListHistoryResponse } = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
      maxResults: 500,
      pageToken,
    });

    for (const entry of data.history ?? []) {
      for (const added of entry.messagesAdded ?? []) {
        const message = added.message;
        if (!message?.id) continue;
        // History carries labels, so promotions and chatter are dropped before
        // we spend a fetch on them.
        if ((message.labelIds ?? []).some((label) => EXCLUDED_LABELS.has(label))) continue;
        ids.add(message.id);
      }
    }

    cursor = data.historyId ?? cursor;
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken && ids.size < INCREMENTAL_LIMIT);

  return { signals: await hydrate(gmail, [...ids].slice(0, INCREMENTAL_LIMIT)), cursor };
}

/**
 * Recent mail that plausibly needs the executive, resuming from the stored
 * cursor when there is one.
 */
export async function fetchGmail(connection: Connection): Promise<GmailFetch> {
  const gmail = google.gmail({ version: "v1", auth: await clientFor(connection) });

  if (connection.cursor) {
    try {
      return await incremental(gmail, connection.cursor);
    } catch (error) {
      // Gmail expires history after about a week. A 404 means the cursor is
      // too old to resume from, which is a backfill, not an outage.
      if (statusOf(error) !== 404) throw error;
      console.warn(`gmail: history cursor expired for ${connection.accountEmail}, backfilling`);
    }
  }

  return backfill(gmail);
}
