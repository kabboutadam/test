import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { Markdown } from "@/lib/markdown";
import { SignedOut } from "@/components/SignedOut";
import { Sparkline } from "@/components/Sparkline";
import { StatTile } from "@/components/StatTile";
import { Avatar } from "@/components/Avatar";
import { MonthlyBars } from "@/components/MonthlyBars";
import { Reading } from "@/components/Reading";
import { metricSeries, openMovements } from "@/core/metrics";
import { whoToTalkTo } from "@/core/people-signals";
import { money, pct, salesView } from "@/core/sales";
import { localParts } from "@/lib/time";
import { resolveDecision, syncNow } from "../inbox/actions";

export const dynamic = "force-dynamic";

const URGENCY_LABEL = ["whenever", "this week", "today", "now"];
const DAY = 86_400_000;

function greeting(hour: number): string {
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

/**
 * The brief as a command centre: what needs you, what moved, how sales is
 * running, and the day's people and meetings, each with its own card. The
 * written brief stays underneath for anyone who wants the narrative.
 */
export default async function BriefPage() {
  const user = await currentUser();
  if (!user) return <SignedOut />;

  const now = new Date();
  const dayEnd = new Date(now.getTime() + DAY);
  const [brief, decisions, needsYou, loops, owed, meetings, preps, movements, movedCount, talkTo, reviews, sales] = await Promise.all([
    db.brief.findFirst({ where: { userId: user.id }, orderBy: { forDate: "desc" } }),
    db.decision.findMany({ where: { userId: user.id, status: "open" }, orderBy: [{ urgency: "desc" }, { createdAt: "asc" }], take: 4, include: { person: true } }),
    db.decision.count({ where: { userId: user.id, status: "open" } }),
    db.loop.findMany({ where: { userId: user.id, status: "waiting", direction: "owed_to_me" }, orderBy: { askedAt: "asc" }, include: { person: true } }),
    db.loop.count({ where: { userId: user.id, status: "waiting", direction: "owed_by_me" } }),
    db.signal.findMany({ where: { userId: user.id, kind: "meeting", occurredAt: { gte: now, lte: dayEnd } }, orderBy: { occurredAt: "asc" }, take: 8 }),
    db.meetingPrep.findMany({ where: { userId: user.id, startsAt: { gte: now } }, select: { id: true, signalId: true, person: { select: { name: true, email: true } } } }),
    openMovements(user.id, 3),
    db.movement.count({ where: { userId: user.id, status: "open" } }),
    whoToTalkTo(user.id, 3),
    db.decisionRecord.findMany({ where: { userId: user.id, status: "open", reviewAt: { lte: dayEnd } }, orderBy: { reviewAt: "asc" }, take: 3 }),
    salesView(user.id, now),
  ]);
  const series = await Promise.all(movements.map((movement) => metricSeries(movement.metricId)));
  const prepFor = new Map(preps.map((prep) => [prep.signalId, prep]));
  const urgent = decisions.filter((decision) => decision.urgency >= 2).length;

  const { hour } = localParts(now, user.timezone);
  const dateLabel = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: user.timezone });
  const clock = (date: Date) => date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: user.timezone });
  const todayKey = now.toLocaleDateString("en-CA", { timeZone: user.timezone });
  const isTomorrow = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: user.timezone }) !== todayKey;
  const firstName = user.name?.split(" ")[0];

  // ---- The day in one line, from the data rather than the model.
  const line: string[] = [];
  if (urgent) line.push(`${urgent} decision${urgent === 1 ? "" : "s"} need${urgent === 1 ? "s" : ""} you today`);
  else if (needsYou) line.push(`${needsYou} decision${needsYou === 1 ? "" : "s"} waiting, none urgent`);
  else line.push("Nothing is waiting on you");
  if (movements[0]) {
    const metric = movements[0].metric;
    line.push(`${metric.name}${metric.segment ? ` at ${metric.segment}` : ""} moved ${movements[0].deviation > 0 ? "up" : "down"}`);
  }
  const nextMeeting = meetings[0];
  if (nextMeeting) line.push(`${nextMeeting.subject} ${isTomorrow(nextMeeting.occurredAt) ? "tomorrow" : "at"} ${clock(nextMeeting.occurredAt)}${prepFor.has(nextMeeting.id) ? ", prep ready" : ""}`);
  const dayLine = `${line.join(". ")}.`;

  const lastMonth = sales?.months.filter((point) => !point.partial).at(-1);
  const lastGap = lastMonth?.target ? lastMonth.actual / lastMonth.target - 1 : null;
  const salesWatch = sales?.readings.find((reading) => reading.tone === "bad");
  const overdue = (loop: (typeof loops)[number]) => (loop.dueAt ? loop.dueAt.getTime() < now.getTime() : now.getTime() - loop.askedAt.getTime() > 7 * DAY);
  const daysOpen = (loop: (typeof loops)[number]) => Math.floor((now.getTime() - loop.askedAt.getTime()) / DAY);

  return (
    <main className="brief">
      <div className="hero">
        <div>
          <div className="eyebrow">{dateLabel}</div>
          <h1>{firstName ? `${greeting(hour)}, ${firstName}.` : "Your brief"}</h1>
          <p className="dayline">{dayLine}</p>
        </div>
        <form action={syncNow}>
          <button>Refresh</button>
        </form>
      </div>

      <div className="stats">
        <StatTile value={needsYou} label="need you" note={urgent ? `${urgent} today` : "nothing urgent"} href="/inbox" tone={urgent ? "bad" : undefined} />
        <StatTile value={movedCount} label="moved" note={movedCount ? "outside normal range" : "all within range"} href="/metrics" tone={movedCount ? "bad" : "good"} />
        <StatTile value={loops.length} label="waiting on" note={owed ? `and you owe ${owed}` : "what others owe you"} href="/loops" />
        {lastMonth ? (
          <StatTile value={lastGap === null ? money(lastMonth.actual, sales!.currency) : pct(lastGap, 1)} label="sales vs target" note={`${money(lastMonth.actual, sales!.currency)} last month`} href="/sales" tone={lastGap === null ? undefined : lastGap < -0.02 ? "bad" : lastGap >= 0 ? "good" : undefined} />
        ) : (
          <StatTile value={meetings.length} label="meetings today" note={`${preps.length} with prep`} />
        )}
      </div>

      <div className="brief-grid">
        <div className="col-main">
          <h2>Needs you today</h2>
          {decisions.length === 0 && <p className="empty">Nothing is waiting on you. Triage runs with every sync.</p>}
          {decisions.map((decision) => (
            <article key={decision.id} className={`card decision-mini${decision.urgency >= 2 ? ` u${decision.urgency}` : ""}`}>
              <div className="card-row">
                {decision.person && <Avatar name={decision.person.name} email={decision.person.email} size={34} />}
                <div>
                  <div className="meta">
                    <span className={`tag u${decision.urgency}`}>{URGENCY_LABEL[decision.urgency]}</span>
                    <span className="tag">{decision.category}</span>
                    {decision.person && <span>{decision.person.name ?? decision.person.email}</span>}
                  </div>
                  <h3>{decision.title}</h3>
                  <p className="why clamp-2">{decision.why}</p>
                  <form className="actions">
                    <button className="primary" formAction={async () => { "use server"; await resolveDecision(decision.id, "approved"); }}>
                      {decision.draft ? "Approve draft" : "Got it"}
                    </button>
                    <button formAction={async () => { "use server"; await resolveDecision(decision.id, "dismissed"); }}>Not mine</button>
                    <Link href="/inbox" className="link-quiet">read the draft →</Link>
                  </form>
                </div>
              </div>
            </article>
          ))}
          {needsYou > decisions.length && (
            <p className="more">
              <Link href="/inbox">All {needsYou} in the inbox →</Link>
            </p>
          )}

          {movements.length > 0 && (
            <>
              <h2>What moved</h2>
              {movements.map((movement, index) => (
                <article key={movement.id} className={`card ${Math.abs(movement.deviation) >= 3 ? "u3" : "u2"}`}>
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
                      <Link href="/metrics" className="link-quiet">all metrics →</Link>
                    </div>
                    {series[index] && <Sparkline series={series[index]!} label={movement.metric.name} />}
                  </div>
                </article>
              ))}
            </>
          )}

          {sales && lastMonth && (
            <>
              <h2>Sales pulse</h2>
              <article className="card pulse">
                <div className="pulse-stats">
                  <div>
                    <div className={`pulse-value${lastGap !== null && lastGap < -0.02 ? " stat-bad" : lastGap !== null && lastGap >= 0 ? " stat-good" : ""}`}>{lastGap === null ? money(lastMonth.actual, sales.currency) : pct(lastGap, 1)}</div>
                    <div className="pulse-label">last month vs target</div>
                  </div>
                  {sales.mtd && (
                    <div>
                      <div className="pulse-value">{money(sales.mtd.pace, sales.currency)}</div>
                      <div className="pulse-label">pacing this month{sales.mtd.target ? ` of ${money(sales.mtd.target, sales.currency)}` : ""}</div>
                    </div>
                  )}
                  {sales.pipeline?.coverage !== null && sales.pipeline?.coverage !== undefined && (
                    <div>
                      <div className={`pulse-value${sales.pipeline.coverage < 1 ? " stat-bad" : ""}`}>{sales.pipeline.coverage.toFixed(1)}×</div>
                      <div className="pulse-label">pipeline vs next quarter</div>
                    </div>
                  )}
                </div>
                <div className="only-wide">
                  <MonthlyBars months={sales.months.slice(-7)} currency={sales.currency} width={560} height={130} />
                </div>
                <div className="only-narrow">
                  <MonthlyBars months={sales.months.slice(-5)} currency={sales.currency} width={320} height={140} />
                </div>
                {salesWatch && <Reading reading={salesWatch} />}
                <Link href="/sales" className="link-quiet" style={{ display: "inline-block", marginTop: 10 }}>full sales page →</Link>
              </article>
            </>
          )}
        </div>

        <aside className="col-rail">
          <h2>Today</h2>
          <div className="card">
            {meetings.length === 0 && <p className="empty" style={{ padding: "8px 0" }}>No meetings in the next 24 hours.</p>}
            <div className="timeline">
              {meetings.map((meeting) => {
                const prep = prepFor.get(meeting.id);
                return (
                  <div key={meeting.id} className={`tl-item${prep ? " has-prep" : ""}`}>
                    <span className="tl-time">{isTomorrow(meeting.occurredAt) ? `tomorrow ${clock(meeting.occurredAt)}` : clock(meeting.occurredAt)}</span>
                    <span className="tl-dot" />
                    <span className="tl-body">
                      <span className="tl-title">{meeting.subject}</span>
                      {prep && (
                        <Link href={`/prep/${prep.id}`} className="tl-prep">
                          {prep.person && <Avatar name={prep.person.name} email={prep.person.email} size={18} />}
                          prep ready →
                        </Link>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {talkTo.length > 0 && (
            <>
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
            </>
          )}

          <h2>Waiting on</h2>
          <div className="card">
            {loops.length === 0 && <p className="empty" style={{ padding: "8px 0" }}>Everyone has come back to you.</p>}
            {loops.slice(0, 4).map((loop) => (
              <div key={loop.id} className="loop-row">
                <Avatar name={loop.person?.name} email={loop.person?.email} size={26} />
                <div className="loop-body">
                  <div className="loop-ask clamp-1">{loop.ask}</div>
                  <div className="loop-who">{loop.person?.name ?? loop.person?.email ?? "unassigned"}</div>
                </div>
                <span className={`tag${overdue(loop) ? " u3" : ""}`}>{daysOpen(loop)}d</span>
              </div>
            ))}
            {(loops.length > 4 || owed > 0) && (
              <p className="more">
                <Link href="/loops">
                  {loops.length > 4 ? `All ${loops.length} →` : "Open the list →"}
                  {owed > 0 ? ` · you owe ${owed}` : ""}
                </Link>
              </p>
            )}
          </div>

          {reviews.length > 0 && (
            <>
              <h2>Decisions due for review</h2>
              <div className="card">
                {reviews.map((record) => (
                  <div key={record.id} className="loop-row">
                    <div className="loop-body">
                      <div className="loop-ask clamp-1">{record.title}</div>
                      <div className="loop-who">expected: {record.expected}</div>
                    </div>
                    <Link href="/decisions" className="link-quiet">close →</Link>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>

      {brief ? (
        <details className="written">
          <summary>
            The written brief for {new Date(brief.forDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}
            <span className="summary-hint">the narrative version, section by section</span>
          </summary>
          <Markdown source={brief.markdown} />
        </details>
      ) : (
        <p className="empty">No written brief yet. Refresh to generate one once a source is connected.</p>
      )}
    </main>
  );
}
