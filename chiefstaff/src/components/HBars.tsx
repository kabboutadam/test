import { money, type Bar } from "@/core/sales";

/** Ranked horizontal bars, one hue, labelled with value and share. */
export function HBars({ rows, currency, unit = "money" }: { rows: Bar[]; currency: string; unit?: "money" | "count" }) {
  const max = Math.max(...rows.map((row) => row.value)) || 1;
  return (
    <div className="hbars">
      {rows.map((row) => (
        <div key={row.label} className="hbar" title={`${row.label}: ${unit === "money" ? money(row.value, currency) : row.value} (${Math.round(row.share * 100)}%)`}>
          <span className="hbar-label">{row.label}</span>
          <span className="hbar-track">
            <span className="hbar-fill" style={{ width: `${(row.value / max) * 100}%` }} />
          </span>
          <span className="hbar-value">{unit === "money" ? money(row.value, currency) : row.value}</span>
          <span className="hbar-share">{Math.round(row.share * 100)}%</span>
        </div>
      ))}
    </div>
  );
}
