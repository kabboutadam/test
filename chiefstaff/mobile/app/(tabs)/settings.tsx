import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, getApiUrl, setApiUrl, useFetch } from "@/api";
import { useSignOut } from "@/auth";
import { CrashNotice } from "@/components/CrashNotice";
import { Button, Card, Lede, Screen, Title } from "@/components/ui";
import { registerForPush } from "@/push";
import { useTheme } from "@/theme";

export default function SettingsScreen() {
  const t = useTheme();
  const signOut = useSignOut();
  const load = useCallback(async () => {
    const [me, sources] = await Promise.all([api.me(), api.integrations().catch(() => ({ integrations: [] }))]);
    return { ...me, integrations: sources.integrations };
  }, []);
  const { data, error } = useFetch(load);
  const integrations = data?.integrations ?? [];
  const me = data?.user;
  const [note, setNote] = useState<string | null>(null);
  const [server, setServer] = useState("");

  useEffect(() => {
    void getApiUrl().then(setServer);
  }, []);

  const saveServer = async () => {
    await setApiUrl(server);
    setNote("Server saved. Pull to refresh any screen.");
  };

  const sync = async () => {
    try {
      await api.sync();
      setNote("Sync queued — pull to refresh the inbox in a moment.");
    } catch (caught) {
      setNote(caught instanceof Error ? caught.message : "could not queue a sync");
    }
  };

  const push = async () => {
    setNote((await registerForPush()) ? "Push is on. The brief will arrive at your brief hour." : "Push is off — allow notifications in system settings, or this is a simulator.");
  };

  const test = async () => {
    try {
      const result = await api.testPush();
      setNote(result.sent > 0 ? "Sent. It arrives in a few seconds — lock the phone to see it as a banner." : "Nothing sent — tap Turn on push first.");
    } catch (caught) {
      setNote(caught instanceof Error ? caught.message : "could not send");
    }
  };

  const leave = async () => {
    await api.signOut().catch(() => undefined);
    await signOut();
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Title>Settings</Title>
          <Lede>{error ?? (me ? `Signed in as ${me.email}` : "Loading…")}</Lede>
          <CrashNotice />

          {me && (
            <Card>
              <Text style={[styles.label, { color: t.muted }]}>Brief</Text>
              <Text style={[styles.value, { color: t.ink }]}>
                {String(me.briefHour).padStart(2, "0")}:00 · {me.timezone}
              </Text>
              <Text style={[styles.label, { color: t.muted, marginTop: 12 }]}>Sources</Text>
              {integrations.length === 0 && (
                <Text style={[styles.value, { color: t.ink }]}>None yet. Connect mail, calendars and spreadsheets on the web under Connect.</Text>
              )}
              {integrations.map((source) => (
                <View key={source.id} style={styles.source}>
                  <View style={[styles.dot, { backgroundColor: source.status === "error" ? t.urgent : t.ok }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.value, { color: t.ink }]}>{source.label}</Text>
                    <Text style={[styles.sub, { color: source.status === "error" ? t.urgent : t.muted }]} numberOfLines={2}>
                      {source.status === "error"
                        ? source.lastError ?? "error"
                        : source.lastSyncAt
                          ? `synced ${new Date(source.lastSyncAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`
                          : "not synced yet"}
                      {source.account ? ` · ${source.account}` : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          )}

          <View style={styles.stack}>
            <Button onPress={() => void push()}>Turn on push</Button>
            <Button onPress={() => void test()}>Send a test push</Button>
            <Button onPress={() => void sync()} disabled={!me?.connected}>
              Sync now
            </Button>
            <Button onPress={() => void leave()}>Unlink this phone</Button>
          </View>
          {note && <Text style={[styles.note, { color: t.muted }]}>{note}</Text>}

          <Text style={[styles.label, { color: t.muted, marginTop: 28 }]}>Server</Text>
          <TextInput
            value={server}
            onChangeText={setServer}
            onBlur={() => void saveServer()}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[styles.input, { color: t.ink, borderColor: t.line, backgroundColor: t.panel }]}
          />

          <Text style={[styles.foot, { color: t.muted }]}>
            Every source is read-only. Drafts are never sent by this app.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 2 },
  value: { fontSize: 15 },
  stack: { gap: 8, marginTop: 4 },
  note: { fontSize: 13, lineHeight: 19, marginTop: 12 },
  source: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  sub: { fontSize: 12, lineHeight: 16 },
  input: { fontSize: 14, borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  foot: { fontSize: 12, lineHeight: 18, marginTop: 20 },
});
