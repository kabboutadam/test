import { useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, useFetch } from "@/api";
import { DecisionCard } from "@/components/DecisionCard";
import { Empty, Lede, Screen, Title } from "@/components/ui";

export default function InboxScreen() {
  const load = useCallback(async () => {
    const [inbox, roster] = await Promise.all([api.decisions(), api.people().catch(() => ({ people: [] }))]);
    return { ...inbox, people: roster.people };
  }, []);
  const { data, error, loading, refresh } = useFetch(load);
  const decisions = data?.decisions ?? [];
  const people = data?.people ?? [];

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
        >
          <Title>Decision inbox</Title>
          <Lede>
            {error ??
              (decisions.length === 0
                ? "Nothing is waiting on you."
                : `${decisions.length} ${decisions.length === 1 ? "thing needs" : "things need"} you. Nothing sends without your approval.`)}
          </Lede>
          {decisions.map((decision) => (
            <DecisionCard key={decision.id} decision={decision} people={people} onResolved={() => void refresh()} />
          ))}
          {!loading && decisions.length === 0 && !error && (
            <Empty>Everything triaged so far has been handled or was never yours.</Empty>
          )}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { padding: 20, paddingBottom: 40 } });
