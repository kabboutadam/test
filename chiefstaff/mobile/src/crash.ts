import * as SecureStore from "expo-secure-store";

/**
 * Crash reporting for a product with no crash reporter yet. A fatal
 * JavaScript error is written down before the app dies, and shown on the
 * next launch, so the phone itself says what went wrong. Native crashes
 * never reach this code; for those the iOS crash log is the only witness.
 */

const KEY = "chiefstaff.lastCrash";

export interface CrashRecord {
  at: string;
  message: string;
  stack: string;
}

type ErrorUtilsLike = {
  getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
  setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};

function describe(error: unknown): CrashRecord {
  const asError = error instanceof Error ? error : new Error(String(error));
  return {
    at: new Date().toISOString(),
    message: asError.message,
    stack: (asError.stack ?? "").split("\n").slice(0, 12).join("\n"),
  };
}

export async function recordCrash(error: unknown): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(describe(error)));
  } catch {
    // Nothing sensible to do if the keychain itself is the problem.
  }
}

export async function takeLastCrash(): Promise<CrashRecord | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    await SecureStore.deleteItemAsync(KEY);
    return JSON.parse(raw) as CrashRecord;
  } catch {
    return null;
  }
}

/** Install once, as early as possible. Chains to React Native's own handler. */
export function installCrashHandler(): void {
  const utils = (globalThis as unknown as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!utils?.setGlobalHandler) return;
  const previous = utils.getGlobalHandler?.();
  utils.setGlobalHandler((error, isFatal) => {
    void recordCrash(error);
    previous?.(error, isFatal);
  });
}
