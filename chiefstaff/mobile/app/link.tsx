import * as Device from "expo-device";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiError } from "@/api";
import { setToken } from "@/auth";
import { Button, Lede, Screen, Title } from "@/components/ui";
import { useTheme } from "@/theme";

export default function LinkScreen() {
  const t = useTheme();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cleaned = code.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const link = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.link(cleaned, Device.modelName ?? Platform.OS);
      await setToken(result.token);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "could not reach the server");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.wrap}>
          <Text style={[styles.brand, { color: t.ink }]}>ChiefStaff</Text>
          <Title>Link this phone</Title>
          <Lede>On the web, open Settings and choose “Link your phone”. Type the code it shows.</Lede>

          <TextInput
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            maxLength={7}
            placeholder="ABC 234"
            placeholderTextColor={t.muted}
            style={[styles.input, { color: t.ink, borderColor: error ? t.urgent : t.line, backgroundColor: t.panel }]}
            onSubmitEditing={() => cleaned.length === 6 && void link()}
          />
          {error && <Text style={[styles.error, { color: t.urgent }]}>{error}</Text>}

          <View style={{ marginTop: 16 }}>
            <Button primary disabled={busy || cleaned.length !== 6} onPress={() => void link()}>
              {busy ? "Linking…" : "Link"}
            </Button>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: "center" },
  brand: { fontSize: 14, fontWeight: "700", marginBottom: 28, letterSpacing: -0.2 },
  input: { fontSize: 30, letterSpacing: 6, textAlign: "center", borderWidth: 1, borderRadius: 12, paddingVertical: 16, fontVariant: ["tabular-nums"] },
  error: { marginTop: 10, fontSize: 14 },
});
