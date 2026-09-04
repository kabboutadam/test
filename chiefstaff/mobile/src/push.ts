import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Ask for permission and hand the server this phone's push token. Safe to
 * call on every launch: the server upserts, and a denied permission is a
 * quiet no rather than an error.
 */
export async function registerForPush(): Promise<boolean> {
  // Simulators have no push token; don't pretend.
  if (!Device.isDevice) return false;

  const existing = await Notifications.getPermissionsAsync();
  const status =
    existing.status === "granted" ? existing.status : (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("brief", {
      name: "Morning brief",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  // Without an explicit projectId the call fails in EAS builds with
  // "No projectId found" — the single most common push setup failure.
  const projectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await api.registerDevice(token, Platform.OS);
  return true;
}
