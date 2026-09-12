import Link from "next/link";
import { currentUser } from "@/lib/session";
import { SignedOut } from "@/components/SignedOut";
import { StatTile } from "@/components/StatTile";
import { MonthlyBars } from "@/components/MonthlyBars";
import { HBars } from "@/components/HBars";
import { Reading } from "@/components/Reading";
import { Sparkline } from "@/components/Sparkline";
import { money, pct, salesView, SALES_KEYS } from "@/core/sales";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const user = await currentUser();
  if (!user) return <SignedOut />;
  const view = await salesView(user.id);

  if (!view) {
    return (
      <main>
        <h1>Sales</h1>
        <p className="lede">Nothing here yet. Import a CSV on the Moved page with any of these metric names and this page fills itself.</p>
        <article className="card">
          {Object.entries(SALES_KEYS).map(([key, hint]) => (
            <div key={key} className="metric-row">
              <div>
                <div className="name">{key}</div>
                <div className="sub">{hint}</div>
              </div>
            </div>
          ))}
        </article>
        <p className="empty">
          <Link href="/metrics">Go to import →</Link>
        </p>
      </main>
    );
  }

  const { currency, months, mtd, ytd, lines, pipeline, customers, kpis, readings } = view;
  const last = months.filter((point) => !point.partial).at(-1);
  const lastGap = last?.target ? last.actual / last.target - 1 : null;
  const about = (topic: string) => readings.filter((reading) => reading.topic === topic);
  const fmtKpi = (value: number, unit: string) => (unit === "%" ? `${value.toFixed(1)}%` : /^[€$£]$/.test(unit) ? money(value, unit) : `${Math.round(value)}${unit ? ` ${unit}` : ""}`);

  return (
    <main>
      <div className="hero">
        <div>
          <div className="eyebrow">Sales</div>
          <h1>{last ? `${money(last.actual, currency)} last month` : "Sales"}</h1>
        </div>
      </div>

      <div className="stats">
        {last && <StatTile value={lastGap === null ? money(last.actual, currency) : pct(lastGap, 1)} label="vs target, last month" note={last.target ? `${money(last.actual, currency)} of ${money(last.target, currency)}` : money(last.actual, currency)} tone={lastGap === null ? undefined : lastGap < -0.02 ? "bad" : lastGap >= 0 ? "good" : undefined} />}
        {mtd && <StatTile value={money(mtd.actual, currency)} label="month to date" note={mtd.target ? `on pace for ${money(mtd.pace, currency)} of ${money(mtd.target, currency)}` : `day ${mtd.day} of ${mtd.days}`} tone={mtd.target ? (mtd.pace / mtd.target < 0.97 ? "bad" : mtd.pace >= mtd.target ? "good" : undefined) : undefined} />}
        <StatTile value={money(ytd.actual, currency)} label="year to date" note={ytd.target ? `${pct(ytd.actual / ytd.target - 1, 1)} vs target` : "no target set"} tone={ytd.target ? (ytd.actual < ytd.target * 0.98 ? "bad" : ytd.actual >= ytd.target ? "good" : undefined) : undefined} />
        {pipeline && <StatTile value={pipeline.coverage !== null ? `${pipeline.coverage.toFixed(1)}×` : money(pipeline.total, currency)} label="pipeline coverage" note={pipeline.coverage !== null ? `${money(pipeline.total, currency)} open vs next quarter` : "no forward targets"} tone={pipeline.coverage === null ? undefined : pipeline.coverage < 1 ? "bad" : pipeline.coverage >= 2 ? "good" : undefined} />}
      </div>

      <h2>Revenue against target</h2>
      <article className="card">
        <div className="legend">
          <span className="legend-item"><span className="swatch swatch-bar" /> actual</span>
          <span className="legend-item"><span className="swatch swatch-tick" /> target</span>
          {mtd && <span className="legend-item"><span className="swatch swatch-hatch" /> month to date</span>}
        </div>
        <div className="only-wide">
          <MonthlyBars months={months} currency={currency} />
        </div>
        <div className="only-narrow">
          <MonthlyBars months={months.slice(-7)} currency={currency} width={360} height={170} />
        </div>
        {about("revenue").map((reading) => (
          <Reading key={reading.text} reading={reading} />
        ))}
      </article>

      {lines.length > 0 && (
        <>
          <h2>By business line</h2>
          <article className="card">
            {lines.map((line) => (
              <div key={line.name} className="metric-row">
                <div>
                  <div className="name">{line.name}</div>
                  <div className="sub">
                    {money(line.latest, currency)} last month
                    {line.growth !== null ? ` · ${pct(line.growth)} vs its 12-month average` : ""}
                  </div>
                </div>
                <Sparkline series={line.series} width={160} height={44} label={line.name} />
              </div>
            ))}
            {about("lines").map((reading) => (
              <Reading key={reading.text} reading={reading} />
            ))}
          </article>
        </>
      )}

      <div className="split">
        {pipeline && (
          <div>
            <h2>Pipeline by stage</h2>
            <article className="card">
              <HBars rows={pipeline.stages} currency={currency} />
              <p className="sub" style={{ marginTop: 8 }}>
                {money(pipeline.total, currency)} open as of {pipeline.asOf}
              </p>
              {about("pipeline").map((reading) => (
                <Reading key={reading.text} reading={reading} />
              ))}
            </article>
          </div>
        )}
        {customers && (
          <div>
            <h2>Top customers, trailing 12 months</h2>
            <article className="card">
              <HBars rows={customers.rows} currency={currency} />
              {about("customers").map((reading) => (
                <Reading key={reading.text} reading={reading} />
              ))}
            </article>
          </div>
        )}
      </div>

      {kpis.length > 0 && (
        <>
          <h2>Rates</h2>
          <div className="stats">
            {kpis.map((kpi) => {
              const good = kpi.delta === null || kpi.goodWhen === "neutral" ? undefined : (kpi.goodWhen === "up") === kpi.delta > 0;
              return (
                <StatTile
                  key={kpi.key}
                  value={fmtKpi(kpi.value, kpi.unit)}
                  label={kpi.label}
                  note={kpi.delta === null ? kpi.note : `${pct(kpi.delta)} on prior month`}
                  tone={good === undefined || Math.abs(kpi.delta ?? 0) < 0.02 ? undefined : good ? "good" : "bad"}
                />
              );
            })}
          </div>
          {about("rates").map((reading) => (
            <Reading key={reading.text} reading={reading} />
          ))}
        </>
      )}

      <p className="empty">
        Numbers come from the metric store. Add rows to the CSV on the <Link href="/metrics">Moved page</Link> and this page updates; anything that leaves its normal range still lands in the brief.
      </p>
    </main>
  );
}
