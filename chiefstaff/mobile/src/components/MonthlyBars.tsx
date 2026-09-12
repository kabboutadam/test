import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, G, Line, Pattern, Rect, Text as SvgText } from "react-native-svg";
import type { MonthPoint } from "@/api";
import { money, monthLabel } from "@/format";
import { useTheme } from "@/theme";

/** Monthly revenue bars with a target tick per month. Tap a bar for its numbers. */
export function MonthlyBars({ months, currency, width, height = 170 }: { months: MonthPoint[]; currency: string; width: number; height?: number }) {
  const t = useTheme();
  const [picked, setPicked] = useState<number | null>(null);
  const padL = 4;
  const padR = 4;
  const padT = 22;
  const padB = 20;
  const n = months.length;
  const max = Math.max(...months.map((point) => Math.max(point.actual, point.target ?? 0))) || 1;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const slot = plotW / n;
  const barW = Math.max(6, Math.min(24, slot * 0.58));
  const x = (index: number) => padL + slot * index + (slot - barW) / 2;
  const y = (value: number) => padT + plotH * (1 - value / max);
  const shown = picked ?? n - 1;
  const point = months[shown];
  const gap = point.target ? point.actual / point.target - 1 : null;

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <Pattern id="hatch" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Line x1={0} y1={0} x2={0} y2={6} stroke={t.panel} strokeWidth={2} />
          </Pattern>
        </Defs>
        <Line x1={padL} x2={width - padR} y1={padT + plotH} y2={padT + plotH} stroke={t.line} strokeWidth={1} />
        {months.map((item, index) => {
          const top = y(item.actual);
          const under = item.target !== null && !item.partial && item.actual < item.target;
          return (
            <G key={item.month} onPress={() => setPicked(index)}>
              <Rect x={padL + slot * index} y={padT} width={slot} height={plotH} fill={index === shown ? t.band : "transparent"} />
              <Rect x={x(index)} y={top} width={barW} height={Math.max(2, padT + plotH - top)} rx={3} fill={t.chart} opacity={under ? 0.55 : 1} />
              {item.partial && <Rect x={x(index)} y={top} width={barW} height={Math.max(2, padT + plotH - top)} rx={3} fill="url(#hatch)" />}
              {item.target !== null && <Line x1={x(index) - 3} x2={x(index) + barW + 3} y1={y(item.target)} y2={y(item.target)} stroke={t.ink} strokeWidth={2} strokeLinecap="round" />}
              {(index % 3 === 0 || index === n - 1) && (
                <SvgText x={x(index) + barW / 2} y={height - 5} fontSize={10.5} fill={t.muted} textAnchor="middle">
                  {monthLabel(item.month)}
                </SvgText>
              )}
            </G>
          );
        })}
        <SvgText x={x(shown) + barW / 2} y={y(point.actual) - 6} fontSize={11} fontWeight="600" fill={t.ink} textAnchor="middle">
          {money(point.actual, currency)}
        </SvgText>
      </Svg>
      <Text style={[styles.caption, { color: t.muted }]}>
        {monthLabel(point.month)} {point.month.slice(0, 4)}
        {point.partial ? " to date" : ""}: {money(point.actual, currency)}
        {point.target !== null ? ` vs ${money(point.target, currency)} target` : ""}
        {gap !== null ? ` (${gap >= 0 ? "+" : "−"}${Math.abs(gap * 100).toFixed(1)}%)` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 12, marginTop: 4 },
});
