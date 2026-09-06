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
  const load = useCallback(() => api.me(), []);
  const { data, error } = useFetch(load);
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
              <Text style={[styles.value, { color: t.ink }]}>
                {me.connected ? "Google Workspace connected" : "None — connect Google on the web"}
              </Text>
            </Card>
          )}

          <View style={styles.stack}>
            <Button onPress={() => void push()}>Turn on push</Button>
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
            Read-only Gmail and Calendar, read as you. Drafts are never sent by this app.
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
  input: { fontSize: 14, borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  foot: { fontSize: 12, lineHeight: 18, marginTop: 20 },
});
