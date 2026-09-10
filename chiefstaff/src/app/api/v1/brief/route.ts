import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { parseBrief } from "@/lib/brief-blocks";
import { authed, json } from "@/lib/api";

/** The latest brief, parsed into blocks so the phone needs no markdown parser. */
export async function GET(request: NextRequest) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;

  const now = new Date();
  const [brief, needsYou, urgent, waiting, moved, meetings, preps] = await Promise.all([
    db.brief.findFirst({ where: { userId: auth.user.id }, orderBy: { forDate: "desc" } }),
    db.decision.count({ where: { userId: auth.user.id, status: "open" } }),
    db.decision.count({ where: { userId: auth.user.id, status: "open", urgency: { gte: 2 } } }),
    db.loop.count({ where: { userId: auth.user.id, status: "waiting", direction: "owed_to_me" } }),
    db.movement.count({ where: { userId: auth.user.id, status: "open" } }),
    db.signal.findMany({
      where: { userId: auth.user.id, kind: "meeting", occurredAt: { gte: now, lte: new Date(now.getTime() + 86_400_000) } },
      orderBy: { occurredAt: "asc" },
      take: 8,
    }),
    db.meetingPrep.findMany({ where: { userId: auth.user.id, startsAt: { gte: now } }, select: { id: true, signalId: true } }),
  ]);
  const prepFor = new Map(preps.map((prep) => [prep.signalId, prep.id]));

  return json({
    stats: { needsYou, urgent, waiting, moved, meetings: meetings.length, prepared: preps.length },
    meetings: meetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.subject,
      startsAt: meeting.occurredAt.toISOString(),
      prepId: prepFor.get(meeting.id) ?? null,
    })),
    greeting: { name: auth.user.name, timezone: auth.user.timezone },
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
