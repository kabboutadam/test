/**
 * What every connector must produce. Adding Slack or a CRM means writing a
 * function that returns these — nothing downstream of ingest knows about Google.
 */
export interface RawSignal {
  source: "gmail" | "gcal" | "imap" | "ics" | "webhook";
  externalId: string;
  kind: "email" | "meeting" | "message";
  threadKey?: string;
  subject: string;
  snippet: string;
  body?: string;
  url?: string;
  occurredAt: Date;
  /** Email address of the sender / organizer. */
  fromEmail?: string;
  fromName?: string;
  /** Every address on the signal, executive included. */
  participants: string[];
  raw?: unknown;
}
