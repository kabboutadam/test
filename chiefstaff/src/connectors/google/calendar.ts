import { google } from "googleapis";
import type { Connection } from "@prisma/client";
import { clientFor } from "./oauth";
import type { RawSignal } from "../types";

/**
 * The next few days of meetings. Calendar is what makes a brief actionable —
 * "you're seeing them at 2pm" is the difference between a summary and a prep.
 */
export async function fetchCalendar(connection: Connection, daysAhead = 3): Promise<RawSignal[]> {
  const calendar = google.calendar({ version: "v3", auth: await clientFor(connection) });

  const now = new Date();
  const { data } = await calendar.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + daysAhead * 86_400_000).toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 100,
  });

  return (data.items ?? [])
    .filter((event) => event.status !== "cancelled" && event.start)
    .map((event) => {
      const attendees = (event.attendees ?? [])
        .map((attendee) => attendee.email?.toLowerCase())
        .filter((email): email is string => Boolean(email));

      return {
        source: "gcal" as const,
        externalId: event.id!,
        kind: "meeting" as const,
        threadKey: event.recurringEventId ?? event.id ?? undefined,
        subject: event.summary ?? "(no title)",
        snippet: [event.location, `${attendees.length} attendees`].filter(Boolean).join(" · "),
        body: (event.description ?? "").slice(0, 4_000),
        url: event.htmlLink ?? undefined,
        occurredAt: new Date(event.start!.dateTime ?? event.start!.date!),
        fromEmail: event.organizer?.email?.toLowerCase(),
        fromName: event.organizer?.displayName ?? undefined,
        participants: [...new Set(attendees)],
      };
    });
}
