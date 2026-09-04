import { useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, useFetch } from "@/api";
import { Blocks } from "@/components/Blocks";
import { Empty, Lede, Screen, Title } from "@/components/ui";

export default function BriefScreen() {
  const load = useCallback(() => api.brief(), []);
  const { data, error, loading, refresh } = useFetch(load);
  const brief = data?.brief;

  const dateLabel = brief
    ? new Date(`${brief.forDate}T00:00:00Z`).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      })
    : null;

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
        >
          <Title>Your brief</Title>
          <Lede>{dateLabel ?? (error ?? "No brief yet.")}</Lede>
          {brief ? <Blocks blocks={brief.blocks} /> : !loading && <Empty>Your first brief arrives at your brief hour once a source is connected on the web.</Empty>}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { padding: 20, paddingBottom: 40 } });
