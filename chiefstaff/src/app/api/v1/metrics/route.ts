import type { NextRequest } from "next/server";
import { authed, error, json } from "@/lib/api";
import { detectMovements, importMetricRows, parseMetricsCsv, type MetricRow } from "@/core/metrics";

/**
 * Inbound numbers from Zapier, Make, n8n or a script. Accepts the CSV the
 * import page takes, or JSON rows with the same column names. Idempotent on
 * (metric, segment, period), so a zap that re-posts is harmless.
 */
export async function POST(request: NextRequest) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;

  const type = request.headers.get("content-type") ?? "";
  let rows: MetricRow[] = [];
  let errors: string[] = [];

  if (type.includes("json")) {
    const body = (await request.json().catch(() => null)) as { rows?: Record<string, unknown>[] } | null;
    if (!body || !Array.isArray(body.rows)) return error("expected {\"rows\":[...]}", 400);
    const header = ["metric", "period", "value", "segment", "unit", "good_when", "owner"];
    const csv = [header.join(","), ...body.rows.map((row) => header.map((column) => JSON.stringify(String(row[column] ?? ""))).join(","))].join("\n");
    ({ rows, errors } = parseMetricsCsv(csv));
  } else {
    ({ rows, errors } = parseMetricsCsv(await request.text()));
  }
  if (rows.length === 0) return error(errors[0] ?? "no rows", 400);

  const imported = await importMetricRows(auth.user, rows, "api");
  const moved = await detectMovements(auth.user);
  return json({ ...imported, moved: moved.moved, errors });
}
