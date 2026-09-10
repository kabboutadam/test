import type { Metric, MetricPoint, User } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Metrics and "what moved" (spec 5.1).
 *
 * The principle that decides everything here: anomalies are relative to each
 * metric's own history, never to a fixed threshold. A 34% labor cost is an
 * emergency at one location and a Tuesday at another. The sentence carries
 * the comparison basis, because a number without one is a number the
 * executive has to go and check.
 */

/** Fewest history points before a movement can be claimed. */
const MIN_HISTORY = 4;
/** Longest history considered, so a metric can drift to a new normal. */
const WINDOW = 13;

// -------------------------------------------------------------- CSV import

export interface MetricRow {
  key: string;
  name: string;
  segment: string;
  period: Date;
  value: number;
  unit: string;
  goodWhen: "up" | "down" | "neutral";
  owner: string;
}

/**
 * Parses the spreadsheet a controller emails on Monday. Columns, any order,
 * header row required: metric, period, value; optional segment, unit,
 * good_when (up|down|neutral), owner (email). Metric names become keys.
 */
export function parseMetricsCsv(text: string): { rows: MetricRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const errors: string[] = [];
  if (lines.length < 2) return { rows: [], errors: ["file has no data rows"] };

  const split = (line: string) =>
    line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((cell) => cell.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ?? [];

  const header = split(lines[0]).map((cell) => cell.toLowerCase().replace(/\s+/g, "_"));
  const col = (name: string) => header.indexOf(name);
  const required = ["metric", "period", "value"].filter((name) => col(name) < 0);
  if (required.length) return { rows: [], errors: [`missing column(s): ${required.join(", ")}`] };

  const rows: MetricRow[] = [];
  lines.slice(1).forEach((line, index) => {
    const cells = split(line);
    const name = cells[col("metric")] ?? "";
    const period = new Date(cells[col("period")] ?? "");
    const value = Number(cells[col("value")]);
    if (!name || Number.isNaN(period.getTime()) || Number.isNaN(value)) {
      errors.push(`row ${index + 2}: need a metric name, a date and a number`);
      return;
    }
    const goodWhenRaw = (col("good_when") >= 0 ? cells[col("good_when")] : "").toLowerCase();
    rows.push({
      key: name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
      name,
      segment: col("segment") >= 0 ? (cells[col("segment")] ?? "") : "",
      period: new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth(), period.getUTCDate())),
      value,
      unit: col("unit") >= 0 ? (cells[col("unit")] ?? "") : "",
      goodWhen: goodWhenRaw === "up" || goodWhenRaw === "down" ? goodWhenRaw : "neutral",
      owner: col("owner") >= 0 ? (cells[col("owner")] ?? "").toLowerCase() : "",
    });
  });
  return { rows, errors };
}

/** Upsert rows into metrics and points. Idempotent on (metric, period). */
export async function importMetricRows(user: User, rows: MetricRow[], source = "csv"): Promise<{ metrics: number; points: number }> {
  const seen = new Set<string>();
  let points = 0;

  for (const row of rows) {
    const owner = row.owner
      ? await db.person.findUnique({ where: { userId_email: { userId: user.id, email: row.owner } } })
      : null;

    const metric = await db.metric.upsert({
      where: { userId_key_segment: { userId: user.id, key: row.key, segment: row.segment } },
      create: {
        userId: user.id,
        key: row.key,
        name: row.name,
        segment: row.segment,
        unit: row.unit,
        goodWhen: row.goodWhen,
        ownerId: owner?.id ?? null,
        source,
      },
      update: {
        ...(row.unit ? { unit: row.unit } : {}),
        ...(row.goodWhen !== "neutral" ? { goodWhen: row.goodWhen } : {}),
        ...(owner ? { ownerId: owner.id } : {}),
      },
    });
    seen.add(metric.id);

    await db.metricPoint.upsert({
      where: { metricId_periodStart: { metricId: metric.id, periodStart: row.period } },
      create: { metricId: metric.id, periodStart: row.period, value: row.value, source },
      update: { value: row.value, source },
    });
    points++;
  }
  return { metrics: seen.size, points };
}

// ------------------------------------------------------------ detection

function formatValue(value: number, unit: string): string {
  if (unit === "%") return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
  if (unit === "$" || unit === "€" || unit === "£") {
    const abs = Math.abs(value);
    const text = abs >= 1_000_000 ? `${(abs / 1_000_000).toFixed(1)}M` : abs >= 10_000 ? `${Math.round(abs / 1000)}K` : abs.toLocaleString("en-US", { maximumFractionDigits: 0 });
    return `${value < 0 ? "-" : ""}${unit}${text}`;
  }
  const rounded = Math.abs(value) >= 100 ? Math.round(value).toLocaleString("en-US") : value.toFixed(1).replace(/\.0$/, "");
  return unit ? `${rounded} ${unit}` : rounded;
}

export interface Detected {
  metric: Metric;
  latest: MetricPoint;
  baseline: number;
  deviation: number;
  sentence: string;
}

/**
 * Compare the latest point to the mean and spread of the points before it.
 * Returns null when the history is too short to say anything honest, or the
 * spread is zero (a constant series that changed is reported as a big move).
 */
export function detect(metric: Metric, points: MetricPoint[]): Detected | null {
  const ordered = [...points].sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime()).slice(-WINDOW);
  if (ordered.length < MIN_HISTORY) return null;

  const latest = ordered[ordered.length - 1];
  const history = ordered.slice(0, -1).map((point) => point.value);
  const mean = history.reduce((sum, value) => sum + value, 0) / history.length;
  const variance = history.reduce((sum, value) => sum + (value - mean) ** 2, 0) / history.length;
  const spread = Math.sqrt(variance);

  const deviation = spread === 0 ? (latest.value === mean ? 0 : Math.sign(latest.value - mean) * 10) : (latest.value - mean) / spread;
  if (Math.abs(deviation) < metric.sensitivity) return null;

  const where = metric.segment ? ` at ${metric.segment}` : "";
  const direction = deviation > 0 ? "up" : "down";
  const isBad = metric.goodWhen === "neutral" ? null : (metric.goodWhen === "up") !== (deviation > 0);
  const verdict = isBad === null ? "" : isBad ? " — worse" : " — better";
  const sentence =
    `${metric.name}${where} was ${formatValue(latest.value, metric.unit)} ` +
    `vs a ${formatValue(mean, metric.unit)} norm over the previous ${history.length} periods` +
    ` (${direction} ${Math.abs(deviation).toFixed(1)}σ${verdict}).`;

  return { metric, latest, baseline: mean, deviation, sentence };
}

/** Run detection across every unmuted metric; write new Movements. */
export async function detectMovements(user: User): Promise<{ checked: number; moved: number }> {
  const metrics = await db.metric.findMany({
    where: { userId: user.id, muted: false },
    include: { points: { orderBy: { periodStart: "desc" }, take: WINDOW } },
  });

  let moved = 0;
  for (const metric of metrics) {
    const found = detect(metric, metric.points);
    if (!found) continue;

    const existing = await db.movement.findUnique({
      where: { metricId_periodStart: { metricId: metric.id, periodStart: found.latest.periodStart } },
    });
    if (existing) continue;

    await db.movement.create({
      data: {
        userId: user.id,
        metricId: metric.id,
        periodStart: found.latest.periodStart,
        value: found.latest.value,
        baseline: found.baseline,
        deviation: found.deviation,
        sentence: found.sentence,
      },
    });
    moved++;
  }
  return { checked: metrics.length, moved };
}

/**
 * The executive's verdict on a movement. "Not useful" raises the metric's
 * sensitivity a notch, so the same size of wobble does not come back next
 * week — the tuning loop the spec asks for, without a settings screen.
 */
export async function markMovement(userId: string, id: string, status: "useful" | "not_useful"): Promise<void> {
  const movement = await db.movement.findFirst({ where: { id, userId } });
  if (!movement) return;
  await db.movement.update({ where: { id }, data: { status } });
  if (status === "not_useful") {
    await db.metric.update({
      where: { id: movement.metricId },
      data: { sensitivity: { increment: 0.5 } },
    });
  }
}

/** Open movements for the brief, biggest first, capped as the spec says. */
export async function openMovements(userId: string, limit = 3) {
  return db.movement.findMany({
    where: { userId, status: "open" },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { metric: { include: { owner: true } } },
  }).then((movements) => movements.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation)).slice(0, limit));
}

/** Sources that have not reported recently. The brief says so instead of going quiet. */
export async function staleMetrics(userId: string, maxAgeDays = 14) {
  const metrics = await db.metric.findMany({
    where: { userId, muted: false },
    include: { points: { orderBy: { periodStart: "desc" }, take: 1 } },
  });
  const cutoff = Date.now() - maxAgeDays * 86_400_000;
  return metrics.filter((metric) => !metric.points[0] || metric.points[0].periodStart.getTime() < cutoff);
}

export interface Series {
  /** Oldest first. */
  values: number[];
  dates: string[];
  /** Mean and spread of everything before the last point — the "normal" band. */
  baseline: number;
  sigma: number;
  unit: string;
  goodWhen: string;
}

/** History for a sparkline. `baseline`/`sigma` exclude the last point, as detection does. */
export async function metricSeries(metricId: string, limit = WINDOW): Promise<Series | null> {
  const metric = await db.metric.findUnique({
    where: { id: metricId },
    include: { points: { orderBy: { periodStart: "desc" }, take: limit } },
  });
  if (!metric || metric.points.length === 0) return null;

  const ordered = [...metric.points].reverse();
  const values = ordered.map((point) => point.value);
  const history = values.slice(0, -1);
  const baseline = history.length ? history.reduce((sum, value) => sum + value, 0) / history.length : values[0];
  const variance = history.length ? history.reduce((sum, value) => sum + (value - baseline) ** 2, 0) / history.length : 0;

  return {
    values,
    dates: ordered.map((point) => point.periodStart.toISOString().slice(0, 10)),
    baseline,
    sigma: Math.sqrt(variance),
    unit: metric.unit,
    goodWhen: metric.goodWhen,
  };
}
