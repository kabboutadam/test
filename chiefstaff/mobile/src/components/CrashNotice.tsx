import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { takeLastCrash, type CrashRecord } from "@/crash";
import { useTheme } from "@/theme";

/** Shows what killed the app last time, once, then forgets it. */
export function CrashNotice() {
  const t = useTheme();
  const [crash, setCrash] = useState<CrashRecord | null>(null);

  useEffect(() => {
    void takeLastCrash().then(setCrash);
  }, []);

  if (!crash) return null;
  return (
    <View style={[styles.box, { borderColor: t.urgent, backgroundColor: t.panel }]}>
      <Text style={[styles.title, { color: t.urgent }]}>The app crashed last time ({crash.at.slice(11, 19)} UTC)</Text>
      <Text style={[styles.body, { color: t.ink }]} selectable>
        {crash.message}
      </Text>
      <Text style={[styles.stack, { color: t.muted }]} selectable>
        {crash.stack}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  title: { fontSize: 12, fontWeight: "700", marginBottom: 6 },
  body: { fontSize: 13, marginBottom: 6 },
  stack: { fontSize: 10, fontFamily: "Menlo" },
});
