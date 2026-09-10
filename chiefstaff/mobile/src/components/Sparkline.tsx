import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import type { Series } from "@/api";
import { useTheme } from "@/theme";

/** One metric's history with its normal band and the latest point marked. */
export function Sparkline({ series, width = 150, height = 52 }: { series: Series; width?: number; height?: number }) {
  const t = useTheme();
  const { values, baseline, sigma, unit, goodWhen } = series;
  const pad = 6;
  const n = values.length;
  const bandLow = baseline - 2 * sigma;
  const bandHigh = baseline + 2 * sigma;
  const min = Math.min(...values, bandLow);
  const max = Math.max(...values, bandHigh);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / Math.max(1, n - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values[n - 1];
  const deviation = sigma === 0 ? 0 : (last - baseline) / sigma;
  const moved = Math.abs(deviation) >= 2;
  const isBad = goodWhen === "neutral" ? null : (goodWhen === "up") !== (last > baseline);
  const marker = !moved ? t.chart : isBad === false ? t.good : isBad ? t.bad : t.chart;
  const fmt = (v: number) => (unit === "%" ? `${v.toFixed(1)}%` : /^[€$£]$/.test(unit) ? `${unit}${Math.round(v).toLocaleString("en-US")}` : `${Math.round(v * 10) / 10}`);

  return (
    <Svg width={width} height={height}>
      <Rect x={pad} y={y(bandHigh)} width={width - pad * 2} height={Math.max(2, y(bandLow) - y(bandHigh))} rx={2} fill={t.band} />
      <Line x1={pad} x2={width - pad} y1={y(baseline)} y2={y(baseline)} stroke={t.faint} strokeWidth={1} />
      <Path d={d} stroke={t.chart} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={x(n - 1)} cy={y(last)} r={4.5} fill={marker} stroke={t.panel} strokeWidth={2} />
      <SvgText x={width - pad} y={Math.min(height - 4, Math.max(11, y(last) - 8))} textAnchor="end" fontSize={11} fontWeight="600" fill={t.muted}>
        {fmt(last)}
      </SvgText>
    </Svg>
  );
}
