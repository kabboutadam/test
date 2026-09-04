import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { SignedOut } from "@/components/SignedOut";
import { hitRates, RECORD_CATEGORIES } from "@/core/decision-log";
import { logDecisionAction, recordOutcomeAction } from "../inbox/actions";

export const dynamic = "force-dynamic";

const pct = (value: number) => `${Math.round(value * 100)}%`;

export default async function DecisionsPage({ searchParams }: { searchParams: Promise<{ from?: string; title?: string; why?: string }> }) {
  const user = await currentUser();
  if (!user) return <SignedOut />;
  const params = await searchParams;

  const [records, people, metrics, rates] = await Promise.all([
    db.decisionRecord.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { reviewAt: "asc" }],
      include: { owner: true, decider: true, metric: true },
    }),
    db.person.findMany({ where: { userId: user.id, importance: { gte: 10 } }, orderBy: { importance: "desc" }, take: 30 }),
    db.metric.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
    hitRates(user.id),
  ]);

  const open = records.filter((record) => record.status === "open");
  const closed = records.filter((record) => record.status !== "open");

  return (
    <main>
      <h1>Decision log</h1>
      <p className="lede">
        Decisions recorded with the expectation behind them. On the review date the loop closes: by the data where it can, by asking the owner where it can’t.
      </p>

      <h2>Log a decision</h2>
      <form action={logDecisionAction} className="card" style={{ display: "grid", gap: 10 }}>
        <input type="hidden" name="fromDecisionId" value={params.from ?? ""} />
        <input name="title" placeholder="What was decided" required defaultValue={params.title ?? ""} />
        <textarea name="rationale" placeholder="Why — one or two sentences" rows={2} defaultValue={params.why ?? ""} />
        <input name="expected" placeholder="Expected outcome, as a measurable claim where possible" required />
        <div className="actions" style={{ flexWrap: "wrap" }}>
          <select name="category" defaultValue="other">
            {RECORD_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select name="owner" defaultValue="">
            <option value="">owner (optional)</option>
            {people.map((person) => (
              <option key={person.id} value={person.email}>{person.name ?? person.email}</option>
            ))}
          </select>
          <label>
            review in <input name="reviewDays" type="number" defaultValue={60} min={1} style={{ width: 64 }} /> days
          </label>
        </div>
        <div className="actions" style={{ flexWrap: "wrap" }}>
          <select name="metricId" defaultValue="">
            <option value="">tie to a metric (optional)</option>
            {metrics.map((metric) => (
              <option key={metric.id} value={metric.id}>{metric.name}{metric.segment ? ` · ${metric.segment}` : ""}</option>
            ))}
          </select>
          <input name="expectedValue" type="number" step="any" placeholder="expected value" style={{ width: 140 }} />
          <button className="primary">Log it</button>
        </div>
      </form>

      <h2>Open ({open.length})</h2>
      {open.length === 0 && <p className="empty">Nothing logged yet.</p>}
      {open.map((record) => (
        <article key={record.id} className="card">
          <div className="meta">
            <span className="tag">{record.category}</span>
            <span>review {record.reviewAt.toISOString().slice(0, 10)}</span>
            {record.owner && <span>owner {record.owner.name ?? record.owner.email}</span>}
            {record.reviewRequestedAt && <span className="tag u2">review in inbox</span>}
          </div>
          <h3>{record.title}</h3>
          <p className="why">Expected: {record.expected}{record.metric && record.expectedValue != null ? ` (${record.metric.name} → ${record.expectedValue})` : ""}</p>
          <form action={recordOutcomeAction} className="actions" style={{ flexWrap: "wrap" }}>
            <input type="hidden" name="id" value={record.id} />
            <input name="outcome" placeholder="What actually happened" style={{ flex: 1, minWidth: 200 }} />
            {(["hit", "miss", "mixed", "dropped"] as const).map((status) => (
              <button key={status} name="status" value={status} className={status === "hit" ? "primary" : undefined}>
                {status}
              </button>
            ))}
          </form>
        </article>
      ))}

      {rates.closed > 0 && (
        <>
          <h2>Hit rate ({rates.closed} closed)</h2>
          <div className="card">
            {rates.byCategory.map((row) => (
              <div key={row.name} className="meta"><span><strong>{row.name}</strong></span><span>{pct(row.rate)} · {row.hit} hit, {row.mixed} mixed, {row.miss} miss</span></div>
            ))}
          </div>
          <div className="card">
            {rates.byDecider.map((row) => (
              <div key={row.name} className="meta"><span><strong>{row.name}</strong></span><span>{pct(row.rate)} over {row.total}</span></div>
            ))}
          </div>
        </>
      )}

      {closed.length > 0 && (
        <>
          <h2>Closed</h2>
          {closed.map((record) => (
            <article key={record.id} className="card">
              <div className="meta">
                <span className={`tag ${record.status === "miss" ? "u3" : record.status === "hit" ? "" : "u2"}`}>{record.status}</span>
                <span>{record.category}</span>
                {record.reviewedAt && <span>closed {record.reviewedAt.toISOString().slice(0, 10)}</span>}
              </div>
              <h3>{record.title}</h3>
              <p className="why">Expected: {record.expected}{record.outcome ? ` — Actual: ${record.outcome}` : ""}</p>
            </article>
          ))}
        </>
      )}
    </main>
  );
}
