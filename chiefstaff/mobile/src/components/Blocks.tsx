import { StyleSheet, Text, View } from "react-native";
import type { Block, Span } from "@/api";
import { useTheme } from "@/theme";

/** Renders the brief from server-parsed blocks. No markdown on the phone. */
function Spans({ spans, color }: { spans: Span[]; color: string }) {
  return (
    <Text style={[styles.text, { color }]}>
      {spans.map((span, index) => (
        <Text key={index} style={span.bold ? styles.bold : undefined}>
          {span.text}
        </Text>
      ))}
    </Text>
  );
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  const t = useTheme();
  return (
    <View>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <Text key={index} style={[styles.heading, { color: t.accent, borderTopColor: t.line, borderTopWidth: index ? 1 : 0 }]}>
              {block.spans.map((span) => span.text).join("").toUpperCase()}
            </Text>
          );
        }
        if (block.type === "list") {
          return (
            <View key={index} style={styles.list}>
              {block.items.map((item, itemIndex) => (
                <View key={itemIndex} style={styles.item}>
                  <Text style={[styles.bullet, { color: t.muted }]}>•</Text>
                  <View style={{ flex: 1 }}>
                    <Spans spans={item} color={t.ink} />
                  </View>
                </View>
              ))}
            </View>
          );
        }
        return (
          <View key={index} style={styles.paragraph}>
            <Spans spans={block.spans} color={t.ink} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 12.5, fontWeight: "700", letterSpacing: 1, marginTop: 22, paddingTop: 18, marginBottom: 10 },
  paragraph: { marginBottom: 12 },
  list: { marginBottom: 6 },
  item: { flexDirection: "row", gap: 8, marginBottom: 8 },
  bullet: { fontSize: 16, lineHeight: 23 },
  text: { fontSize: 16, lineHeight: 23 },
  bold: { fontWeight: "700" },
});
