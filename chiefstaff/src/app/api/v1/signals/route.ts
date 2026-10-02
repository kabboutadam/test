import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { authed, error, json } from "@/lib/api";
import { storeSignals } from "@/core/ingest";
import type { RawSignal } from "@/connectors/types";

interface Item {
  id?: string;
  subject?: string;
  text?: string;
  from?: string;
  fromName?: string;
  participants?: string[];
  url?: string;
  occurredAt?: string;
  kind?: "message" | "email";
}

/**
 * Inbound messages from anything: a Slack mention via Zapier, a support
 * ticket, a form. They enter the same triage as email, so the next sync
 * decides whether one of them needs the executive.
 */
export async function POST(request: NextRequest) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as { items?: Item[] } | null;
  if (!body || !Array.isArray(body.items)) return error("expected {\"items\":[...]}", 400);

  const raws: RawSignal[] = body.items
    .filter((item) => item && (item.subject || item.text))
    .slice(0, 200)
    .map((item) => {
      const text = String(item.text ?? "").slice(0, 8_000);
      const subject = String(item.subject ?? text.slice(0, 80) ?? "(no subject)");
      const from = item.from?.toLowerCase();
      return {
        source: "webhook" as const,
        externalId: item.id ? String(item.id) : createHash("sha256").update(`${subject}|${text}|${item.occurredAt ?? ""}`).digest("hex").slice(0, 32),
        kind: item.kind === "email" ? ("email" as const) : ("message" as const),
        subject,
        snippet: text.slice(0, 200),
        body: text,
        url: item.url,
        occurredAt: item.occurredAt ? new Date(item.occurredAt) : new Date(),
        fromEmail: from,
        fromName: item.fromName,
        participants: [...new Set([from, ...(item.participants ?? []).map((email) => email.toLowerCase())].filter((email): email is string => Boolean(email)))],
      };
    });

  const result = await storeSignals(auth.user, raws);
  return json(result);
}
