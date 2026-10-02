import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { RawSignal } from "./types";

/**
 * Any mailbox that speaks IMAP with a password: iCloud, Fastmail, Yahoo,
 * Zoho, Gmail with an app password, company mail. Read-only: we open INBOX
 * with a read lock and never flag, move or delete.
 *
 * Microsoft accounts are the exception — Outlook.com and Microsoft 365 no
 * longer accept passwords over IMAP, so they need the OAuth connector.
 */
export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
}

export interface ImapFetch {
  signals: RawSignal[];
  /** Highest UID seen; the next sync starts after it. */
  cursor: string | null;
}

const BACKFILL_DAYS = 7;
const MAX_MESSAGES = 200;

function client(config: ImapConfig, password: string): ImapFlow {
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: password },
    logger: false,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
  });
}

/** Connect, open INBOX, disconnect. Throws with the server's words on failure. */
export async function testImap(config: ImapConfig, password: string): Promise<{ messages: number }> {
  const imap = client(config, password);
  await imap.connect();
  try {
    const box = await imap.mailboxOpen("INBOX", { readOnly: true });
    return { messages: box.exists };
  } finally {
    await imap.logout().catch(() => undefined);
  }
}

export async function fetchImap(config: ImapConfig, password: string, cursor: string | null): Promise<ImapFetch> {
  const imap = client(config, password);
  await imap.connect();
  const signals: RawSignal[] = [];
  let highest = cursor ? Number(cursor) : 0;

  try {
    const lock = await imap.getMailboxLock("INBOX", { readOnly: true });
    try {
      const since = new Date(Date.now() - BACKFILL_DAYS * 86_400_000);
      const range = cursor ? `${Number(cursor) + 1}:*` : { since };
      const uids = (await imap.search(range as never, { uid: true })) || [];
      const wanted = uids.filter((uid) => uid > highest).slice(-MAX_MESSAGES);

      for (const uid of wanted) {
        const message = await imap.fetchOne(String(uid), { uid: true, source: true, envelope: true }, { uid: true });
        if (!message || !message.source) continue;
        const parsed = await simpleParser(message.source);
        const from = parsed.from?.value[0];
        const everyone = [parsed.from, parsed.to, parsed.cc]
          .flatMap((field) => (Array.isArray(field) ? field : field ? [field] : []))
          .flatMap((field) => field.value)
          .map((address) => address.address?.toLowerCase())
          .filter((address): address is string => Boolean(address));
        const text = (parsed.text ?? "").replace(/\s+/g, " ").trim();
        signals.push({
          source: "imap",
          externalId: parsed.messageId ?? `${config.user}:${uid}`,
          kind: "email",
          threadKey: parsed.inReplyTo ?? parsed.messageId ?? undefined,
          subject: parsed.subject ?? "(no subject)",
          snippet: text.slice(0, 200),
          body: text.slice(0, 8_000),
          occurredAt: parsed.date ?? (message.envelope?.date ? new Date(message.envelope.date) : new Date()),
          fromEmail: from?.address?.toLowerCase(),
          fromName: from?.name || undefined,
          participants: [...new Set(everyone)],
        });
        highest = Math.max(highest, uid);
      }
    } finally {
      lock.release();
    }
  } finally {
    await imap.logout().catch(() => undefined);
  }

  return { signals, cursor: highest ? String(highest) : cursor };
}
