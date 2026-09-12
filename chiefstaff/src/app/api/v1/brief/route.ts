import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { parseBrief } from "@/lib/brief-blocks";
import { authed, json } from "@/lib/api";
import { openMovements } from "@/core/metrics";
import { whoToTalkTo } from "@/core/people-signals";

const DAY = 86_400_000;

/**
 * Everything the phone's Brief tab shows, in one call: counts, the day in
 * one line, today's meetings with prep, who to talk to, what you are
 * waiting on, reviews due, and the written brief parsed into blocks.
 */
export async function GET(request: NextRequest) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;
  const userId = auth.user.id;
  const timezone = auth.user.timezone;

  const now = new Date();
  const dayEnd = new Date(now.getTime() + DAY);
  const [brief, needsYou, urgent, moved, loops, owed, meetings, preps, movements, talkTo, reviews] = await Promise.all([
    db.brief.findFirst({ where: { userId }, orderBy: { forDate: "desc" } }),
    db.decision.count({ where: { userId, status: "open" } }),
    db.decision.count({ where: { userId, status: "open", urgency: { gte: 2 } } }),
    db.movement.count({ where: { userId, status: "open" } }),
    db.loop.findMany({ where: { userId, status: "waiting", direction: "owed_to_me" }, orderBy: { askedAt: "asc" }, include: { person: true } }),
    db.loop.count({ where: { userId, status: "waiting", direction: "owed_by_me" } }),
    db.signal.findMany({ where: { userId, kind: "meeting", occurredAt: { gte: now, lte: dayEnd } }, orderBy: { occurredAt: "asc" }, take: 8 }),
    db.meetingPrep.findMany({ where: { userId, startsAt: { gte: now } }, select: { id: true, signalId: true } }),
    openMovements(userId, 1),
    whoToTalkTo(userId, 3),
    db.decisionRecord.findMany({ where: { userId, status: "open", reviewAt: { lte: dayEnd } }, orderBy: { reviewAt: "asc" }, take: 3 }),
  ]);
  const prepFor = new Map(preps.map((prep) => [prep.signalId, prep.id]));
  const todayKey = now.toLocaleDateString("en-CA", { timeZone: timezone });
  const clock = (date: Date) => date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: timezone });
  const isTomorrow = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: timezone }) !== todayKey;

  const line: string[] = [];
  if (urgent) line.push(`${urgent} decision${urgent === 1 ? "" : "s"} need${urgent === 1 ? "s" : ""} you today`);
  else if (needsYou) line.push(`${needsYou} decision${needsYou === 1 ? "" : "s"} waiting, none urgent`);
  else line.push("Nothing is waiting on you");
  if (movements[0]) {
    const metric = movements[0].metric;
    line.push(`${metric.name}${metric.segment ? ` at ${metric.segment}` : ""} moved ${movements[0].deviation > 0 ? "up" : "down"}`);
  }
  if (meetings[0]) {
    line.push(`${meetings[0].subject} ${isTomorrow(meetings[0].occurredAt) ? "tomorrow" : "at"} ${clock(meetings[0].occurredAt)}${prepFor.has(meetings[0].id) ? ", prep ready" : ""}`);
  }

  return json({
    stats: { needsYou, urgent, waiting: loops.length, owed, moved, meetings: meetings.length, prepared: preps.length },
    dayLine: `${line.join(". ")}.`,
    meetings: meetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.subject,
      startsAt: meeting.occurredAt.toISOString(),
      tomorrow: isTomorrow(meeting.occurredAt),
      prepId: prepFor.get(meeting.id) ?? null,
    })),
    talkTo,
    waiting: loops.slice(0, 4).map((loop) => ({
      id: loop.id,
      ask: loop.ask,
      person: loop.person ? { name: loop.person.name, email: loop.person.email } : null,
      daysOpen: Math.floor((now.getTime() - loop.askedAt.getTime()) / DAY),
      overdue: loop.dueAt ? loop.dueAt.getTime() < now.getTime() : now.getTime() - loop.askedAt.getTime() > 7 * DAY,
    })),
    reviews: reviews.map((record) => ({ id: record.id, title: record.title, expected: record.expected })),
    greeting: { name: auth.user.name, timezone },
    brief: brief
      ? {
          id: brief.id,
          forDate: brief.forDate.toISOString().slice(0, 10),
          createdAt: brief.createdAt.toISOString(),
          blocks: parseBrief(brief.markdown),
        }
      : null,
  });
}
