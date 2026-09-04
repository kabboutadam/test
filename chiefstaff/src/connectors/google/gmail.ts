import { google, type gmail_v1 } from "googleapis";
import type { Connection } from "@prisma/client";
import { clientFor } from "./oauth";
import type { RawSignal } from "../types";

/** Bounded so a first sync on a 200k-message mailbox doesn't run for an hour. */
const MAX_MESSAGES = 150;

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

/**
 * Recent mail that plausibly needs the executive. The query does the cheap
 * filtering (no promotions, no bulk) so Claude only ever sees candidates.
 */
export async function fetchGmail(connection: Connection): Promise<RawSignal[]> {
  const gmail = google.gmail({ version: "v1", auth: await clientFor(connection) });

  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults: MAX_MESSAGES,
    q: "newer_than:7d -category:promotions -category:social -in:chats",
  });

  const signals: RawSignal[] = [];

  for (const stub of list.data.messages ?? []) {
    if (!stub.id) continue;
    const { data: message } = await gmail.users.messages.get({
      userId: "me",
      id: stub.id,
      format: "full",
    });

    const from = parseAddresses(header(message, "From"))[0];
    const participants = [
      ...parseAddresses(header(message, "From")),
      ...parseAddresses(header(message, "To")),
      ...parseAddresses(header(message, "Cc")),
    ].map((address) => address.email);

    signals.push({
      source: "gmail",
      externalId: message.id!,
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
    });
  }

  return signals;
}
