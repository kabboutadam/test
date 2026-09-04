/**
 * Timezone handling for a product whose entire promise is "before your first
 * meeting". Everything here is derived from the executive's own IANA zone via
 * Intl — no date library, and no arithmetic on UTC offsets, which is how DST
 * bugs get written.
 */

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function formatter(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    // An unknown zone must not stop the morning run for everyone else.
    return formatter("UTC");
  }
}

export function localParts(date: Date, timeZone: string): LocalParts {
  const parts = new Map(
    formatter(timeZone)
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.get("year")),
    month: Number(parts.get("month")),
    day: Number(parts.get("day")),
    hour: Number(parts.get("hour")),
    minute: Number(parts.get("minute")),
  };
}

/** "2026-03-10" in the executive's zone. The identity of a brief. */
export function localDateKey(date: Date, timeZone: string): string {
  const { year, month, day } = localParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * The local calendar day as a UTC-midnight Date, which is what a Postgres
 * `date` column round-trips cleanly. Storing UTC midnight of the *UTC* day
 * instead — the previous behaviour — files an Auckland executive's Tuesday
 * brief under Monday.
 */
export function localDayStart(date: Date, timeZone: string): Date {
  return new Date(`${localDateKey(date, timeZone)}T00:00:00.000Z`);
}

/** True once the executive's local clock has reached their brief hour. */
export function isBriefDue(
  user: { timezone: string; briefHour: number },
  now: Date = new Date(),
): boolean {
  return localParts(now, user.timezone).hour >= user.briefHour;
}

/** "07:12" in the executive's zone, for logs a human has to read at 3am. */
export function localClock(date: Date, timeZone: string): string {
  const { hour, minute } = localParts(date, timeZone);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
