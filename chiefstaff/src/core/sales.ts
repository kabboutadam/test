import { db } from "@/lib/db";
import { buildSeries, completePeriods, type Series } from "./metrics";

/**
 * The sales page reads the same metric store the CSV importer fills. It
 * recognises metrics by key (the importer derives keys from names, so the
 * CSV column "Revenue" becomes "revenue"). Segments give the breakdowns:
 * revenue by business line, pipeline by stage, customer_revenue by customer.
 *
 * Every chart carries a reading — the one sentence that says what it means —
 * because a number without an implication is noise to an executive.
 */
export const SALES_KEYS: Record<string, string> = {
  revenue: "Revenue — monthly, company-wide (segment empty) and by business line (segment = line)",
  revenue_target: "Revenue target — monthly",
  bookings: "Bookings — new contracted value per month",
  pipeline: "Pipeline — open value by stage (segment = stage), latest snapshot wins",
  customer_revenue: "Customer revenue — monthly, segment = customer",
  win_rate: "Win rate — % of closed deals won",
  gross_margin: "Gross margin — %",
  avg_deal_size: "Average deal size — currency",
};

export function isSalesKey(key: string): boolean {
  return key in SALES_KEYS;
}

const STAGE_ORDER = ["lead", "qualified", "proposal", "negotiation", "verbal", "closing", "won"];

export interface MonthPoint {
  /** YYYY-MM */
  month: string;
  actual: number;
  target: number | null;
  /** The month in progress: actual is month-to-date. */
  partial: boolean;
}

export interface Bar {
  label: string;
  value: number;
  /** 0..1 of the group total. */
  share: number;
}

export interface Kpi {
  key: string;
  label: string;
  value: number;
  unit: string;
  /** Change vs the prior period as a fraction, null with one point. */
  delta: number | null;
  goodWhen: string;
  note: string;
}

export interface Reading {
  topic: "revenue" | "lines" | "pipeline" | "customers" | "rates";
  tone: "good" | "bad" | "neutral";
  text: string;
}

export interface SalesView {
  currency: string;
  months: MonthPoint[];
  mtd: { actual: number; target: number | null; pace: number; day: number; days: number } | null;
  ytd: { actual: number; target: number | null };
  lines: { name: string; latest: number; growth: number | null; series: Series }[];
  pipeline: { stages: Bar[]; total: number; coverage: number | null; asOf: string } | null;
  customers: { rows: Bar[]; total: number; top1: number; top3: number } | null;
  kpis: Kpi[];
  readings: Reading[];
}

export function money(value: number, currency = "€"): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}${currency}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}${currency}${Math.round(abs / 1_000)}k`;
  return `${sign}${currency}${Math.round(abs)}`;
}

export function pct(fraction: number, digits = 0): string {
  const value = fraction * 100;
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}%`;
}

type Loaded = Awaited<ReturnType<typeof loadSalesMetrics>>;

async function loadSalesMetrics(userId: string) {
  return db.metric.findMany({
    where: { userId, key: { in: Object.keys(SALES_KEYS) } },
    include: { points: { orderBy: { periodStart: "asc" } } },
  });
}

const monthKey = (date: Date) => date.toISOString().slice(0, 7);

function monthly(metric: Loaded[number] | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (const point of metric?.points ?? []) map.set(monthKey(point.periodStart), point.value);
  return map;
}

export async function salesView(userId: string, now = new Date()): Promise<SalesView | null> {
  const metrics = await loadSalesMetrics(userId);
  if (metrics.length === 0) return null;

  const find = (key: string, segment = "") => metrics.find((metric) => metric.key === key && metric.segment === segment);
  const revenue = find("revenue");
  const currency = revenue?.unit && /^[€$£]$/.test(revenue.unit) ? revenue.unit : "€";
  const thisMonth = monthKey(now);
  const readings: Reading[] = [];

  // ---- Monthly revenue against target.
  const actuals = monthly(revenue);
  const targets = monthly(find("revenue_target"));
  const monthKeys = [...actuals.keys()].sort().slice(-13);
  const months: MonthPoint[] = monthKeys.map((month) => ({
    month,
    actual: actuals.get(month)!,
    target: targets.get(month) ?? null,
    partial: month === thisMonth,
  }));
  const complete = months.filter((point) => !point.partial);
  const last = complete.at(-1);

  const day = now.getUTCDate();
  const days = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const current = months.find((point) => point.partial);
  const mtd = current
    ? { actual: current.actual, target: current.target, pace: (current.actual / day) * days, day, days }
    : null;

  const year = thisMonth.slice(0, 4);
  const inYear = months.filter((point) => point.month.startsWith(year));
  const ytd = {
    actual: inYear.reduce((sum, point) => sum + point.actual, 0),
    target: inYear.every((point) => point.target !== null)
      ? inYear.reduce((sum, point) => sum + (point.partial ? (point.target! * day) / days : point.target!), 0)
      : null,
  };

  if (last?.target) {
    const gap = last.actual / last.target - 1;
    const name = new Date(`${last.month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
    readings.push({
      topic: "revenue",
      tone: gap < -0.02 ? "bad" : gap >= 0 ? "good" : "neutral",
      text: `${name} closed at ${money(last.actual, currency)}, ${pct(gap, 1)} against a ${money(last.target, currency)} target${
        ytd.target ? `; year to date is ${pct(ytd.actual / ytd.target - 1, 1)}` : ""
      }.`,
    });
  }
  if (mtd?.target) {
    const paceGap = mtd.pace / mtd.target - 1;
    readings.push({
      topic: "revenue",
      tone: paceGap < -0.03 ? "bad" : paceGap >= 0 ? "good" : "neutral",
      text: `Day ${mtd.day} of ${mtd.days}: ${money(mtd.actual, currency)} in, on pace for ${money(mtd.pace, currency)} against ${money(mtd.target, currency)} (${pct(paceGap, 1)}).`,
    });
  }

  // ---- Business lines: each against its own history.
  const lineMetrics = metrics.filter((metric) => metric.key === "revenue" && metric.segment !== "");
  const lines = (
    await Promise.all(
      lineMetrics.map(async (metric) => {
        const complete = completePeriods(metric.points, now).slice(-13);
        const series = buildSeries(complete, metric);
        if (!series) return null;
        // Compare the last complete month with the mean of the 12 before it.
        const completeValues = complete.map((point) => point.value);
        const latest = completeValues.at(-1)!;
        const history = completeValues.slice(-13, -1);
        const mean = history.length ? history.reduce((sum, value) => sum + value, 0) / history.length : null;
        return { name: metric.segment, latest, growth: mean ? latest / mean - 1 : null, series };
      }),
    )
  ).filter((line): line is NonNullable<typeof line> => line !== null);
  lines.sort((a, b) => b.latest - a.latest);
  if (lines.length >= 2) {
    const weakest = [...lines].sort((a, b) => (a.growth ?? 0) - (b.growth ?? 0))[0];
    const strongest = [...lines].sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0))[0];
    if (weakest.growth !== null && strongest.growth !== null) {
      readings.push({
        topic: "lines",
        tone: weakest.growth < -0.05 ? "bad" : "neutral",
        text: `${weakest.name} is the gap: ${pct(weakest.growth)} against its own 12-month average, while ${strongest.name} is ${pct(strongest.growth)}.`,
      });
    }
  }

  // ---- Pipeline by stage, latest snapshot.
  const stageMetrics = metrics.filter((metric) => metric.key === "pipeline" && metric.points.length > 0);
  let pipeline: SalesView["pipeline"] = null;
  if (stageMetrics.length > 0) {
    const asOf = stageMetrics.map((metric) => metric.points.at(-1)!.periodStart).sort((a, b) => b.getTime() - a.getTime())[0];
    const rows = stageMetrics.map((metric) => ({ label: metric.segment || "Open", value: metric.points.at(-1)!.value }));
    const order = (label: string) => {
      const index = STAGE_ORDER.indexOf(label.toLowerCase());
      return index < 0 ? STAGE_ORDER.length : index;
    };
    rows.sort((a, b) => order(a.label) - order(b.label) || b.value - a.value);
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    // Coverage: open pipeline against the next three months of target.
    const future = [...targets.entries()].filter(([month]) => month > thisMonth).sort().slice(0, 3);
    const nextQuarter = future.length === 3 ? future.reduce((sum, [, value]) => sum + value, 0) : null;
    const coverage = nextQuarter ? total / nextQuarter : null;
    pipeline = { stages: rows.map((row) => ({ ...row, share: total ? row.value / total : 0 })), total, coverage, asOf: asOf.toISOString().slice(0, 10) };
    const late = rows.filter((row) => ["negotiation", "verbal", "closing"].includes(row.label.toLowerCase())).reduce((sum, row) => sum + row.value, 0);
    if (coverage !== null) {
      readings.push({
        topic: "pipeline",
        tone: coverage < 1 ? "bad" : coverage < 2 ? "neutral" : "good",
        text: `Open pipeline is ${money(total, currency)}, ${coverage.toFixed(1)}× the next quarter's target${
          late ? `; ${money(late, currency)} of it is in late stages` : ""
        }.${coverage < 1 ? " Below one times means the quarter depends on renewals." : ""}`,
      });
    }
  }

  // ---- Customers: trailing twelve complete months.
  const customerMetrics = metrics.filter((metric) => metric.key === "customer_revenue");
  let customers: SalesView["customers"] = null;
  if (customerMetrics.length > 0) {
    const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
    const rows = customerMetrics
      .map((metric) => ({
        label: metric.segment || "Unnamed",
        value: metric.points.filter((point) => point.periodStart >= cutoff && monthKey(point.periodStart) !== thisMonth).reduce((sum, point) => sum + point.value, 0),
      }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value);
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    const top = rows.slice(0, 8);
    const rest = rows.slice(8).reduce((sum, row) => sum + row.value, 0);
    if (rest > 0) top.push({ label: `${rows.length - 8} others`, value: rest });
    const top1 = total ? rows[0].value / total : 0;
    const top3 = total ? rows.slice(0, 3).reduce((sum, row) => sum + row.value, 0) / total : 0;
    customers = { rows: top.map((row) => ({ ...row, share: total ? row.value / total : 0 })), total, top1, top3 };
    readings.push({
      topic: "customers",
      tone: top1 > 0.25 || top3 > 0.5 ? "bad" : "neutral",
      text: `Top three customers are ${Math.round(top3 * 100)}% of trailing revenue; ${rows[0].label} alone is ${Math.round(top1 * 100)}%.${
        top1 > 0.25 ? " One renewal is a board-level risk." : ""
      }`,
    });
  }

  // ---- Headline rates.
  const kpis: Kpi[] = [];
  const kpiSpec: [string, string, string][] = [
    ["bookings", "Bookings", "last month, new contracted value"],
    ["win_rate", "Win rate", "of closed deals"],
    ["gross_margin", "Gross margin", "last month"],
    ["avg_deal_size", "Avg deal size", "last month"],
  ];
  for (const [key, label, note] of kpiSpec) {
    const metric = find(key);
    const points = metric?.points.filter((point) => monthKey(point.periodStart) !== thisMonth) ?? [];
    const latest = points.at(-1);
    if (!metric || !latest) continue;
    const prior = points.at(-2);
    kpis.push({
      key,
      label,
      value: latest.value,
      unit: metric.unit,
      delta: prior && prior.value !== 0 ? latest.value / prior.value - 1 : null,
      goodWhen: metric.goodWhen,
      note,
    });
  }
  const margin = kpis.find((kpi) => kpi.key === "gross_margin");
  const winRate = kpis.find((kpi) => kpi.key === "win_rate");
  if (margin?.delta !== null && margin?.delta !== undefined && Math.abs(margin.delta) >= 0.03) {
    readings.push({
      topic: "rates",
      tone: margin.delta < 0 ? "bad" : "good",
      text: `Gross margin moved ${pct(margin.delta, 1)} month on month to ${margin.value.toFixed(1)}%.`,
    });
  } else if (winRate?.delta !== null && winRate?.delta !== undefined && Math.abs(winRate.delta) >= 0.1) {
    readings.push({ topic: "rates", tone: winRate.delta < 0 ? "bad" : "good", text: `Win rate is ${winRate.value.toFixed(0)}%, ${pct(winRate.delta)} on the prior month.` });
  }

  return { currency, months, mtd, ytd, lines, pipeline, customers, kpis, readings };
}
