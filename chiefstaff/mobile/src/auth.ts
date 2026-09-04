import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";

/** The bearer token lives in the keychain, never in AsyncStorage or state files. */
const KEY = "chiefstaff.token";

let cached: string | null | undefined;
const listeners = new Set<(token: string | null) => void>();

export async function getToken(): Promise<string | null> {
  if (cached !== undefined) return cached;
  cached = await SecureStore.getItemAsync(KEY);
  return cached;
}

export async function setToken(token: string | null): Promise<void> {
  cached = token;
  if (token) await SecureStore.setItemAsync(KEY, token);
  else await SecureStore.deleteItemAsync(KEY);
  for (const listener of listeners) listener(token);
}

/** Reactive token: `undefined` while loading, `null` when signed out. */
export function useToken(): string | null | undefined {
  const [token, set] = useState<string | null | undefined>(cached);

  useEffect(() => {
    let live = true;
    void getToken().then((value) => live && set(value));
    listeners.add(set);
    return () => {
      live = false;
      listeners.delete(set);
    };
  }, []);

  return token;
}

export function useSignOut(): () => Promise<void> {
  return useCallback(() => setToken(null), []);
}
