import { parseMetricsCsv, type MetricRow } from "@/core/metrics";

/**
 * A spreadsheet published as CSV — Google Sheets "Publish to web", Excel
 * Online, or any URL that returns CSV. Same columns as the manual import, so
 * the finance sheet the controller already keeps becomes the feed.
 */
export async function fetchCsvUrl(url: string): Promise<{ rows: MetricRow[]; errors: string[] }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { "user-agent": "ChiefStaff/1.0" }, redirect: "follow" });
  if (!response.ok) throw new Error(`spreadsheet link answered ${response.status}`);
  const text = await response.text();
  if (/<html/i.test(text.slice(0, 500))) throw new Error("that link returns a web page, not CSV — in Google Sheets use File → Share → Publish to web → CSV");
  return parseMetricsCsv(text);
}

export async function testCsvUrl(url: string): Promise<{ rows: number; metrics: number; errors: string[] }> {
  const { rows, errors } = await fetchCsvUrl(url);
  if (rows.length === 0) throw new Error(errors[0] ?? "no rows found; the sheet needs metric, period and value columns");
  return { rows: rows.length, metrics: new Set(rows.map((row) => `${row.key}|${row.segment}`)).size, errors };
}
