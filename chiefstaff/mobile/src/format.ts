/** Number formatting shared by the sales screens; mirrors src/core/sales.ts on the server. */
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

export function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
}
