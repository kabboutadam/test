import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { SignedOut } from "@/components/SignedOut";
import { importMetricsAction, markMovementAction } from "../inbox/actions";

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

  return (
    <main>
      <h1>What moved</h1>
      <p className="lede">
        Numbers that left their own normal range. Mark one “not useful” and that metric gets quieter.
      </p>

      {movements.filter((movement) => movement.status === "open").map((movement) => (
        <article key={movement.id} className="card">
          <div className="meta">
            <span className={`tag ${Math.abs(movement.deviation) >= 3 ? "u3" : "u2"}`}>
              {movement.deviation > 0 ? "up" : "down"} {Math.abs(movement.deviation).toFixed(1)}σ
            </span>
            <span>{movement.periodStart.toISOString().slice(0, 10)}</span>
            {movement.metric.owner && <span>{movement.metric.owner.name ?? movement.metric.owner.email}</span>}
          </div>
          <h3>{movement.sentence}</h3>
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
      {metrics.map((metric) => (
        <div key={metric.id} className="meta" style={{ marginBottom: 6 }}>
          <span>
            <strong>{metric.name}</strong>
            {metric.segment ? ` · ${metric.segment}` : ""}
          </span>
          <span>
            {metric.points[0]
              ? `${metric.points[0].value}${metric.unit === "%" ? "%" : metric.unit ? ` ${metric.unit}` : ""} on ${metric.points[0].periodStart.toISOString().slice(0, 10)}`
              : "no data"}
          </span>
          <span className="tag">sensitivity {metric.sensitivity.toFixed(1)}σ</span>
          {metric.owner && <span>{metric.owner.name ?? metric.owner.email}</span>}
        </div>
      ))}
    </main>
  );
}
