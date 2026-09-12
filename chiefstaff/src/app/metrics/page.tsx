import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { SignedOut } from "@/components/SignedOut";
import { importMetricsAction, markMovementAction } from "../inbox/actions";
import { Sparkline } from "@/components/Sparkline";
import { Avatar } from "@/components/Avatar";
import { metricSeries } from "@/core/metrics";
import { isSalesKey } from "@/core/sales";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const user = await currentUser();
  if (!user) return <SignedOut />;

  const [movements, metrics] = await Promise.all([
    db.movement.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { metric: { include: { owner: true } } },
    }),
    db.metric.findMany({
      where: { userId: user.id },
      orderBy: [{ name: "asc" }, { segment: "asc" }],
      include: { points: { orderBy: { periodStart: "desc" }, take: 1 }, owner: true },
    }),
  ]);

  const open = movements.filter((movement) => movement.status === "open");
  const openSeries = await Promise.all(open.map((movement) => metricSeries(movement.metricId)));
  // Sales numbers have their own page; here they would drown the operating metrics.
  const salesCount = metrics.filter((metric) => isSalesKey(metric.key)).length;
  const tracked = metrics.filter((metric) => !isSalesKey(metric.key));
  const allSeries = await Promise.all(tracked.map((metric) => metricSeries(metric.id)));

  return (
    <main>
      <h1>What moved</h1>
      <p className="lede">
        Numbers that left their own normal range. Mark one “not useful” and that metric gets quieter.
      </p>

      {open.map((movement, index) => (
        <article key={movement.id} className="card">
          <div className="movement">
            <div>
              <div className="meta">
                <span className={`tag ${Math.abs(movement.deviation) >= 3 ? "u3" : "u2"}`}>
                  {movement.deviation > 0 ? "up" : "down"} {Math.abs(movement.deviation).toFixed(1)}σ
                </span>
                <span>{movement.periodStart.toISOString().slice(0, 10)}</span>
                {movement.metric.owner && (
                  <span className="person">
                    <Avatar name={movement.metric.owner.name} email={movement.metric.owner.email} size={20} />
                    {movement.metric.owner.name ?? movement.metric.owner.email}
                  </span>
                )}
              </div>
              <p className="sentence">{movement.sentence}</p>
            </div>
            {openSeries[index] && <Sparkline series={openSeries[index]!} label={movement.metric.name} />}
          </div>
          <form className="actions">
            <button
              className="primary"
              formAction={async () => {
                "use server";
                await markMovementAction(movement.id, "useful");
              }}
            >
              Useful
            </button>
            <button
              formAction={async () => {
                "use server";
                await markMovementAction(movement.id, "not_useful");
              }}
            >
              Not useful
            </button>
          </form>
        </article>
      ))}
      {movements.every((movement) => movement.status !== "open") && (
        <p className="empty">Nothing outside its normal range right now.</p>
      )}

      <h2>Import numbers</h2>
      <p className="why">
        A CSV with columns <code>metric, period, value</code> and optionally <code>segment, unit, good_when, owner</code>.
        One row per metric per period. The same file next week just adds the new rows.
      </p>
      <form action={importMetricsAction} className="actions" style={{ marginBottom: 24 }}>
        <input type="file" name="file" accept=".csv,text/csv" required />
        <button className="primary">Import</button>
      </form>

      <h2>Tracked metrics</h2>
      {metrics.length === 0 && <p className="empty">No metrics yet. Import a CSV above.</p>}
      {salesCount > 0 && (
        <p className="sub" style={{ marginBottom: 10 }}>
          {salesCount} sales {salesCount === 1 ? "metric lives" : "metrics live"} on the <Link href="/sales">Sales page</Link>.
        </p>
      )}
      <div className="card">
        {tracked.map((metric, index) => (
          <div key={metric.id} className="metric-row">
            <div>
              <div className="name">{metric.name}{metric.segment ? ` · ${metric.segment}` : ""}</div>
              <div className="sub">
                {metric.points[0] ? `latest ${metric.points[0].periodStart.toISOString().slice(0, 10)}` : "no data"} · sensitivity {metric.sensitivity.toFixed(1)}σ
                {metric.owner ? ` · ${metric.owner.name ?? metric.owner.email}` : ""}
              </div>
            </div>
            {allSeries[index] ? <Sparkline series={allSeries[index]!} width={160} height={44} label={metric.name} /> : <span />}
            <span />
          </div>
        ))}
      </div>
    </main>
  );
}
