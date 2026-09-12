import { useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, useFetch } from "@/api";
import { HBars } from "@/components/HBars";
import { MonthlyBars } from "@/components/MonthlyBars";
import { Reading } from "@/components/Reading";
import { Sparkline } from "@/components/Sparkline";
import { Card, Empty, Lede, Screen, Section, StatTile, Title } from "@/components/ui";
import { money, pct } from "@/format";
import { useTheme } from "@/theme";

export default function SalesScreen() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const load = useCallback(() => api.sales(), []);
  const { data, error, loading, refresh } = useFetch(load);
  const view = data?.sales ?? null;

  const chartWidth = Math.max(240, width - 40 - 32);

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}>
          {!view ? (
            <>
              <Title>Sales</Title>
              <Lede>{error ?? "Revenue against target, pipeline and customers, with the reading under each."}</Lede>
              {!loading && !error && <Empty>Nothing here yet. Import a CSV with revenue, revenue_target, pipeline or customer_revenue on the web and this fills itself.</Empty>}
            </>
          ) : (
            <SalesBody view={view} chartWidth={chartWidth} error={error} />
          )}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

function SalesBody({ view, chartWidth, error }: { view: NonNullable<Awaited<ReturnType<typeof api.sales>>["sales"]>; chartWidth: number; error: string | null }) {
  const t = useTheme();
  const { currency, months, mtd, ytd, lines, pipeline, customers, kpis, readings } = view;
  const last = months.filter((point) => !point.partial).at(-1);
  const lastGap = last?.target ? last.actual / last.target - 1 : null;
  const about = (topic: string) => readings.filter((reading) => reading.topic === topic);
  const fmtKpi = (value: number, unit: string) => (unit === "%" ? `${value.toFixed(1)}%` : /^[€$£]$/.test(unit) ? money(value, unit) : `${Math.round(value)}`);

  return (
    <>
      <Text style={[styles.eyebrow, { color: t.muted }]}>Sales</Text>
      <Text style={[styles.hero, { color: t.ink }]}>{last ? `${money(last.actual, currency)} last month` : "Sales"}</Text>
      {error && <Text style={{ color: t.urgent, marginBottom: 12 }}>{error}</Text>}

      <View style={styles.stats}>
        {last && (
          <StatTile
            value={lastGap === null ? money(last.actual, currency) : pct(lastGap, 1)}
            label="vs target, last month"
            note={last.target ? `${money(last.actual, currency)} of ${money(last.target, currency)}` : undefined}
            tone={lastGap === null ? undefined : lastGap < -0.02 ? "bad" : lastGap >= 0 ? "good" : undefined}
          />
        )}
        {mtd && (
          <StatTile
            value={money(mtd.actual, currency)}
            label="month to date"
            note={mtd.target ? `pacing ${money(mtd.pace, currency)} of ${money(mtd.target, currency)}` : `day ${mtd.day} of ${mtd.days}`}
            tone={mtd.target ? (mtd.pace / mtd.target < 0.97 ? "bad" : mtd.pace >= mtd.target ? "good" : undefined) : undefined}
          />
        )}
        <StatTile value={money(ytd.actual, currency)} label="year to date" note={ytd.target ? `${pct(ytd.actual / ytd.target - 1, 1)} vs target` : "no target"} tone={ytd.target ? (ytd.actual < ytd.target * 0.98 ? "bad" : ytd.actual >= ytd.target ? "good" : undefined) : undefined} />
        {pipeline && (
          <StatTile
            value={pipeline.coverage !== null ? `${pipeline.coverage.toFixed(1)}×` : money(pipeline.total, currency)}
            label="pipeline coverage"
            note={pipeline.coverage !== null ? `${money(pipeline.total, currency)} vs next quarter` : "no forward targets"}
            tone={pipeline.coverage === null ? undefined : pipeline.coverage < 1 ? "bad" : pipeline.coverage >= 2 ? "good" : undefined}
          />
        )}
      </View>

      <Section>Revenue against target</Section>
      <Card>
        <View style={styles.legend}>
          <View style={[styles.swatch, { backgroundColor: t.chart }]} />
          <Text style={[styles.legendText, { color: t.muted }]}>actual</Text>
          <View style={[styles.tick, { backgroundColor: t.ink }]} />
          <Text style={[styles.legendText, { color: t.muted }]}>target</Text>
        </View>
        <MonthlyBars months={months} currency={currency} width={chartWidth} />
        {about("revenue").map((reading) => (
            <Reading key={reading.text} reading={reading} />
          ))}
      </Card>

      {lines.length > 0 && (
        <>
          <Section>By business line</Section>
          <Card>
            {lines.map((line, index) => (
              <View key={line.name} style={[styles.line, index > 0 && { borderTopWidth: 1, borderTopColor: t.line }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.lineName, { color: t.ink }]}>{line.name}</Text>
                  <Text style={[styles.lineSub, { color: t.muted }]}>
                    {money(line.latest, currency)}
                    {line.growth !== null ? ` · ${pct(line.growth)} vs 12-mo avg` : ""}
                  </Text>
                </View>
                <Sparkline series={line.series} width={110} height={40} />
              </View>
            ))}
            {about("lines").map((reading) => (
                <Reading key={reading.text} reading={reading} />
              ))}
          </Card>
        </>
      )}

      {pipeline && (
        <>
          <Section>Pipeline by stage</Section>
          <Card>
            <HBars rows={pipeline.stages} currency={currency} />
            <Text style={[styles.lineSub, { color: t.muted, marginTop: 8 }]}>
              {money(pipeline.total, currency)} open as of {pipeline.asOf}
            </Text>
            {about("pipeline").map((reading) => (
                <Reading key={reading.text} reading={reading} />
              ))}
          </Card>
        </>
      )}

      {customers && (
        <>
          <Section>Top customers, trailing 12 months</Section>
          <Card>
            <HBars rows={customers.rows} currency={currency} />
            {about("customers").map((reading) => (
                <Reading key={reading.text} reading={reading} />
              ))}
          </Card>
        </>
      )}

      {kpis.length > 0 && (
        <>
          <Section>Rates</Section>
          <View style={styles.stats}>
            {kpis.map((kpi) => {
              const good = kpi.delta === null || kpi.goodWhen === "neutral" ? undefined : (kpi.goodWhen === "up") === kpi.delta > 0;
              return (
                <StatTile
                  key={kpi.key}
                  value={fmtKpi(kpi.value, kpi.unit)}
                  label={kpi.label}
                  note={kpi.delta === null ? kpi.note : `${pct(kpi.delta)} on prior month`}
                  tone={good === undefined || Math.abs(kpi.delta ?? 0) < 0.02 ? undefined : good ? "good" : "bad"}
                />
              );
            })}
          </View>
          {about("rates").map((reading) => (
            <Reading key={reading.text} reading={reading} />
          ))}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  eyebrow: { fontSize: 12.5, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 },
  hero: { fontSize: 28, fontWeight: "700", letterSpacing: -0.8, lineHeight: 34, marginBottom: 16 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  legend: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  legendText: { fontSize: 12, marginRight: 10 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  tick: { width: 14, height: 2, borderRadius: 1 },
  line: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  lineName: { fontSize: 14, fontWeight: "600" },
  lineSub: { fontSize: 12.5, marginTop: 2 },
});
