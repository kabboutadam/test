import ical, { type VEvent } from "node-ical";
import type { RawSignal } from "./types";

/**
 * A calendar published as an ICS link: Outlook's "publish calendar",
 * Google's "secret address in iCal format", iCloud's public share. No OAuth
 * app, no scopes — the link is the credential, so it is stored encrypted.
 */
const DAYS_AHEAD = 3;

async function load(url: string): Promise<Record<string, unknown>> {
  const normalised = url.replace(/^webcal:\/\//i, "https://");
  const response = await fetch(normalised, { signal: AbortSignal.timeout(20_000), headers: { "user-agent": "ChiefStaff/1.0" } });
  if (!response.ok) throw new Error(`calendar link answered ${response.status}`);
  const text = await response.text();
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("that link is not an ICS calendar");
  return ical.sync.parseICS(text) as Record<string, unknown>;
}

function mailto(value: unknown): { email?: string; name?: string } {
  if (!value) return {};
  const entry = (typeof value === "object" && value !== null && "val" in value ? value : { val: value, params: {} }) as { val: string; params?: { CN?: string } };
  const email = String(entry.val ?? "").replace(/^mailto:/i, "").toLowerCase() || undefined;
  return { email, name: entry.params?.CN };
}

function occurrences(event: VEvent, from: Date, to: Date): Date[] {
  if (event.rrule) {
    const dates = event.rrule.between(from, to, true);
    const exdates = new Set(Object.values(event.exdate ?? {}).map((date) => new Date(date as unknown as string).getTime()));
    return dates.filter((date) => !exdates.has(date.getTime()));
  }
  const start = new Date(event.start);
  return start >= from && start <= to ? [start] : [];
}

export async function testIcs(url: string): Promise<{ events: number }> {
  const parsed = await load(url);
  return { events: Object.values(parsed).filter((entry) => (entry as { type?: string }).type === "VEVENT").length };
}

export async function fetchIcs(url: string, daysAhead = DAYS_AHEAD): Promise<RawSignal[]> {
  const parsed = await load(url);
  const now = new Date();
  const until = new Date(now.getTime() + daysAhead * 86_400_000);
  const signals: RawSignal[] = [];

  for (const entry of Object.values(parsed)) {
    const event = entry as VEvent;
    if (event.type !== "VEVENT" || !event.start) continue;
    if (String(event.status ?? "").toUpperCase() === "CANCELLED") continue;
    const attendees = (Array.isArray(event.attendee) ? event.attendee : event.attendee ? [event.attendee] : []).map(mailto);
    const organizer = mailto(event.organizer);
    const participants = [...new Set([organizer.email, ...attendees.map((attendee) => attendee.email)].filter((email): email is string => Boolean(email)))];

    for (const start of occurrences(event, now, until)) {
      signals.push({
        source: "ics",
        externalId: `${event.uid}@${start.toISOString()}`,
        kind: "meeting",
        threadKey: event.uid,
        subject: (typeof event.summary === "string" ? event.summary : (event.summary as { val?: string } | undefined)?.val) || "(no title)",
        snippet: [event.location, `${attendees.length} attendees`].filter(Boolean).join(" · "),
        body: String(event.description ?? "").slice(0, 4_000),
        url: typeof event.url === "string" ? event.url : undefined,
        occurredAt: start,
        fromEmail: organizer.email,
        fromName: organizer.name,
        participants,
      });
    }
  }
  return signals;
}
