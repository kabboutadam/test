import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { fetchGmail } from "@/connectors/google/gmail";
import { fetchCalendar } from "@/connectors/google/calendar";
import type { RawSignal } from "@/connectors/types";
import { isBulkSender, resolvePeople } from "./people";

export interface IngestResult {
  fetched: number;
  stored: number;
  skipped: number;
}

/** Normalize raw connector output into Signals. Idempotent on (user, source, externalId). */
export async function storeSignals(user: User, raws: RawSignal[]): Promise<IngestResult> {
  let stored = 0;
  let skipped = 0;

  for (const raw of raws) {
    if (raw.fromEmail && isBulkSender(raw.fromEmail)) {
      skipped++;
      continue;
    }

    const existing = await db.signal.findUnique({
      where: {
        userId_source_externalId: { userId: user.id, source: raw.source, externalId: raw.externalId },
      },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const from = await resolvePeople(user.id, user.email, raw);

    await db.signal.create({
      data: {
        userId: user.id,
        source: raw.source,
        externalId: raw.externalId,
        kind: raw.kind,
        threadKey: raw.threadKey ?? null,
        subject: raw.subject,
        snippet: raw.snippet,
        body: raw.body ?? null,
        url: raw.url ?? null,
        occurredAt: raw.occurredAt,
        fromId: from?.id ?? null,
        participants: raw.participants,
      },
    });
    stored++;
  }

  return { fetched: raws.length, stored, skipped };
}

/** Pull every connected source for one executive. */
export async function syncUser(user: User): Promise<IngestResult> {
  const connections = await db.connection.findMany({ where: { userId: user.id } });
  const totals: IngestResult = { fetched: 0, stored: 0, skipped: 0 };

  for (const connection of connections) {
    if (connection.provider !== "google") continue;

    const raws = [...(await fetchGmail(connection)), ...(await fetchCalendar(connection))];
    const result = await storeSignals(user, raws);

    totals.fetched += result.fetched;
    totals.stored += result.stored;
    totals.skipped += result.skipped;

    await db.connection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date() },
    });
  }

  return totals;
}
