import type { Series } from "@/core/metrics";
import { money } from "@/core/sales";

/**
 * One metric's recent history, with its normal band and the latest point
 * marked. Server-rendered SVG; hover any point for its value. Single series,
 * so the title names it and there is no legend. Text stays in ink tokens;
 * only the marks carry the chart colours.
 */
export function Sparkline({
  series,
  width = 220,
  height = 56,
  label,
}: {
  series: Series;
  width?: number;
  height?: number;
  label?: string;
}) {
  const { values, dates, baseline, sigma, unit, goodWhen } = series;
  const pad = 6;
  const n = values.length;
  const bandLow = baseline - 2 * sigma;
  const bandHigh = baseline + 2 * sigma;
  const min = Math.min(...values, bandLow);
  const max = Math.max(...values, bandHigh);
  const span = max - min || 1;

  const x = (index: number) => pad + (index / Math.max(1, n - 1)) * (width - pad * 2);
  const y = (value: number) => pad + (1 - (value - min) / span) * (height - pad * 2);

  const path = values.map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const last = values[n - 1];
  const deviation = sigma === 0 ? 0 : (last - baseline) / sigma;
  const moved = Math.abs(deviation) >= 2;
  const isBad = goodWhen === "neutral" ? null : (goodWhen === "up") !== (last > baseline);
  const markerClass = !moved ? "sp-mark" : isBad === false ? "sp-mark sp-good" : isBad ? "sp-mark sp-bad" : "sp-mark sp-moved";

  const fmt = (value: number) => (unit === "%" ? `${value.toFixed(1)}%` : unit && /^[€$£]$/.test(unit) ? money(value, unit) : `${Math.round(value * 10) / 10}${unit ? ` ${unit}` : ""}`);

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label ?? "History"}: latest ${fmt(last)}, normal ${fmt(baseline)}`}
    >
      <rect className="sp-band" x={pad} y={y(bandHigh)} width={width - pad * 2} height={Math.max(2, y(bandLow) - y(bandHigh))} rx={2} />
      <line className="sp-baseline" x1={pad} x2={width - pad} y1={y(baseline)} y2={y(baseline)} />
      <path className="sp-line" d={path} />
      {values.map((value, index) => (
        <circle key={index} className="sp-hit" cx={x(index)} cy={y(value)} r={7}>
          <title>{`${dates[index]}: ${fmt(value)}`}</title>
        </circle>
      ))}
      <circle className={markerClass} cx={x(n - 1)} cy={y(last)} r={4.5} />
      <text className="sp-label" x={width - pad - 12} y={Math.min(height - 4, Math.max(11, y(last) - 8))} textAnchor="end">
        {fmt(last)}
      </text>
    </svg>
  );
}
