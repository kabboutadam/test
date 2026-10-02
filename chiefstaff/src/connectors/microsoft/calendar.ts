import type { Connection } from "@prisma/client";
import type { RawSignal } from "../types";
import { accessTokenFor, graph } from "./oauth";

/** The next few days from the Outlook calendar, recurrences already expanded by calendarView. */
export interface OutlookEvent {
  id: string;
  subject?: string | null;
  bodyPreview?: string | null;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  location?: { displayName?: string } | null;
  attendees?: { emailAddress?: { address?: string; name?: string } }[];
  organizer?: { emailAddress?: { address?: string; name?: string } } | null;
  webLink?: string | null;
  isCancelled?: boolean;
  seriesMasterId?: string | null;
}

export function toSignal(event: OutlookEvent): RawSignal | null {
  if (!event.id || event.isCancelled || !event.start?.dateTime) return null;
  const attendees = (event.attendees ?? []).map((attendee) => attendee.emailAddress?.address?.toLowerCase()).filter((address): address is string => Boolean(address));
  const organizer = event.organizer?.emailAddress;
  // calendarView returns dateTime in the Prefer'd zone (UTC here) without a suffix.
  const raw = event.start.dateTime;
  const start = new Date(/[Zz]|[+-]\d\d:\d\d$/.test(raw) ? raw : `${raw}Z`);
  return {
    source: "outlook_cal",
    externalId: event.id,
    kind: "meeting",
    threadKey: event.seriesMasterId ?? event.id,
    subject: event.subject || "(no title)",
    snippet: [event.location?.displayName, `${attendees.length} attendees`].filter(Boolean).join(" · "),
    body: (event.bodyPreview ?? "").slice(0, 4_000),
    url: event.webLink ?? undefined,
    occurredAt: start,
    fromEmail: organizer?.address?.toLowerCase(),
    fromName: organizer?.name || undefined,
    participants: [...new Set([organizer?.address?.toLowerCase(), ...attendees].filter((address): address is string => Boolean(address)))],
  };
}

export async function fetchOutlookCalendar(connection: Connection, daysAhead = 3): Promise<RawSignal[]> {
  const token = await accessTokenFor(connection);
  const now = new Date();
  const params = new URLSearchParams({
    startDateTime: now.toISOString(),
    endDateTime: new Date(now.getTime() + daysAhead * 86_400_000).toISOString(),
    $select: "id,subject,bodyPreview,start,end,location,attendees,organizer,webLink,isCancelled,seriesMasterId",
    $orderby: "start/dateTime",
    $top: "100",
  });
  const data = await graph<{ value: OutlookEvent[] }>(token, `/me/calendarView?${params}`, { Prefer: 'outlook.timezone="UTC"' });
  return (data.value ?? []).map(toSignal).filter((signal): signal is RawSignal => signal !== null);
}
