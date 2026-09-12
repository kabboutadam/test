import { money, type MonthPoint } from "@/core/sales";

/**
 * Monthly revenue as thin bars with the target as a tick over each month.
 * Two series, so a legend sits above; the last bar is labelled directly.
 * The month in progress is hatched so month-to-date never reads as a miss.
 */
export function MonthlyBars({ months, currency, width = 640, height = 180 }: { months: MonthPoint[]; currency: string; width?: number; height?: number }) {
  const padL = 8;
  const padR = 8;
  const padT = 22;
  const padB = 22;
  const n = months.length;
  const max = Math.max(...months.map((point) => Math.max(point.actual, point.target ?? 0))) || 1;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const slot = plotW / n;
  const barW = Math.max(6, Math.min(28, slot * 0.58));
  const x = (index: number) => padL + slot * index + (slot - barW) / 2;
  const y = (value: number) => padT + plotH * (1 - value / max);
  const label = (month: string) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  const last = months[n - 1];

  return (
    <svg className="bars" width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Monthly revenue against target, ${n} months`}>
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" className="bar-hatch" />
        </pattern>
      </defs>
      <line className="bar-axis" x1={padL} x2={width - padR} y1={padT + plotH} y2={padT + plotH} />
      {months.map((point, index) => {
        const top = y(point.actual);
        const under = point.target !== null && !point.partial && point.actual < point.target;
        const gap = point.target ? point.actual / point.target - 1 : null;
        return (
          <g key={point.month}>
            <title>
              {`${label(point.month)} ${point.month.slice(0, 4)}${point.partial ? " (month to date)" : ""}: ${money(point.actual, currency)}${
                point.target !== null ? ` vs target ${money(point.target, currency)}${gap !== null ? ` (${gap >= 0 ? "+" : "−"}${Math.abs(gap * 100).toFixed(1)}%)` : ""}` : ""
              }`}
            </title>
            <rect className="bar-hit" x={padL + slot * index} y={padT} width={slot} height={plotH} />
            <rect className={`bar-actual${under ? " bar-under" : ""}`} x={x(index)} y={top} width={barW} height={Math.max(2, padT + plotH - top)} rx={3} />
            {point.partial && <rect x={x(index)} y={top} width={barW} height={Math.max(2, padT + plotH - top)} rx={3} fill="url(#hatch)" />}
            {point.target !== null && <line className="bar-target" x1={x(index) - 3} x2={x(index) + barW + 3} y1={y(point.target)} y2={y(point.target)} />}
            {(index % 3 === 0 || index === n - 1) && (
              <text className="bar-month" x={x(index) + barW / 2} y={height - 6} textAnchor="middle">
                {label(point.month)}
              </text>
            )}
          </g>
        );
      })}
      <text className="bar-value" x={x(n - 1) + barW / 2} y={y(last.actual) - 6} textAnchor="middle">
        {money(last.actual, currency)}
        {last.partial ? " mtd" : ""}
      </text>
    </svg>
  );
}
