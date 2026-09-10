import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { Markdown } from "@/lib/markdown";
import { SignedOut } from "@/components/SignedOut";
import { Sparkline } from "@/components/Sparkline";
import { StatTile } from "@/components/StatTile";
import { Avatar } from "@/components/Avatar";
import { metricSeries, openMovements } from "@/core/metrics";
import { whoToTalkTo } from "@/core/people-signals";
import { localParts } from "@/lib/time";
import { syncNow } from "../inbox/actions";

export const dynamic = "force-dynamic";

function greeting(hour: number): string {
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

export default async function BriefPage() {
  const user = await currentUser();
  if (!user) return <SignedOut />;

  const now = new Date();
  const dayEnd = new Date(now.getTime() + 86_400_000);
  const [brief, needsYou, waiting, meetings, preps, movements, talkTo] = await Promise.all([
    db.brief.findFirst({ where: { userId: user.id }, orderBy: { forDate: "desc" } }),
    db.decision.count({ where: { userId: user.id, status: "open" } }),
    db.loop.count({ where: { userId: user.id, status: "waiting", direction: "owed_to_me" } }),
    db.signal.findMany({ where: { userId: user.id, kind: "meeting", occurredAt: { gte: now, lte: dayEnd } }, orderBy: { occurredAt: "asc" }, take: 8 }),
    db.meetingPrep.findMany({ where: { userId: user.id, startsAt: { gte: now } }, select: { id: true, signalId: true } }),
    openMovements(user.id, 3),
    whoToTalkTo(user.id, 2),
  ]);
  const series = await Promise.all(movements.map((movement) => metricSeries(movement.metricId)));
  const prepFor = new Map(preps.map((prep) => [prep.signalId, prep.id]));
  const urgentCount = await db.decision.count({ where: { userId: user.id, status: "open", urgency: { gte: 2 } } });

  const { hour } = localParts(now, user.timezone);
  const dateLabel = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: user.timezone });
  const firstName = user.name?.split(" ")[0];

  return (
    <main>
      <div className="hero">
        <div>
          <div className="eyebrow">{dateLabel}</div>
          <h1>{firstName ? `${greeting(hour)}, ${firstName}.` : "Your brief"}</h1>
        </div>
        <form action={syncNow}>
          <button>Refresh</button>
        </form>
      </div>

      <div className="stats">
        <StatTile value={needsYou} label="need you" note={urgentCount ? `${urgentCount} today` : "nothing urgent"} href="/inbox" tone={urgentCount ? "bad" : undefined} />
        <StatTile value={movements.length} label="moved" note={movements.length ? "outside normal range" : "all within range"} href="/metrics" tone={movements.length ? "bad" : "good"} />
        <StatTile value={waiting} label="waiting on" note="what others owe you" href="/loops" />
        <StatTile value={meetings.length} label="meetings today" note={`${preps.length} with prep`} />
      </div>

      {brief ? (
        <Markdown source={brief.markdown} />
      ) : (
        <p className="empty">No brief yet. Refresh to generate one — or, with no model key, the seeded day is a fair preview.</p>
      )}

      {movements.length > 0 && (
        <>
          <h2>What moved</h2>
          {movements.map((movement, index) => (
            <article key={movement.id} className="card">
              <div className="movement">
                <div>
                  <div className="meta">
                    <span className={`tag ${Math.abs(movement.deviation) >= 3 ? "u3" : "u2"}`}>
                      {movement.deviation > 0 ? "up" : "down"} {Math.abs(movement.deviation).toFixed(1)}σ
                    </span>
                    {movement.metric.owner && (
                      <span className="person">
                        <Avatar name={movement.metric.owner.name} email={movement.metric.owner.email} size={20} />
                        {movement.metric.owner.name ?? movement.metric.owner.email}
                      </span>
                    )}
                  </div>
                  <p className="sentence">{movement.sentence}</p>
                  <Link href="/metrics" style={{ fontSize: 13 }}>all metrics →</Link>
                </div>
                {series[index] && <Sparkline series={series[index]!} label={movement.metric.name} />}
              </div>
            </article>
          ))}
        </>
      )}

      <div className="split">
        {talkTo.length > 0 && (
          <section>
            <h2>Who to talk to</h2>
            <div className="card people">
              {talkTo.map((person) => (
                <div key={person.email} className="person">
                  <Avatar name={person.name} email={person.email} size={36} />
                  <div>
                    <div className="name">{person.name}</div>
                    <div className="reason">{person.reasons.join("; ")}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        {meetings.length > 0 && (
          <section>
            <h2>Today</h2>
            <div className="card">
              {meetings.map((meeting) => (
                <div key={meeting.id} className="meeting">
                  <span className="time">{meeting.occurredAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: user.timezone })}</span>
                  <span className="title">{meeting.subject}</span>
                  {prepFor.has(meeting.id) && <Link className="prep" href={`/prep/${prepFor.get(meeting.id)}`}>prep →</Link>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
