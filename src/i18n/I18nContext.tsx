/**
 * Language + RTL context for the parent app.
 *
 * - Persists the chosen language to secure-store so it survives restarts.
 * - Applies RTL layout for Arabic via I18nManager. Because RN only flips the
 *   layout on the *next* launch, switching language prompts a reload: we call
 *   forceRTL and, on native, ask expo-updates/DevSettings to reload so mirrored
 *   layout takes effect immediately.
 * - Exposes `t(key, vars)` bound to the current language, plus `lang`,
 *   `setLang`, and `isRTL`.
 */

import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { I18nManager } from 'react-native';

import { Lang, translate } from './strings';

const LANG_KEY = 'busmapp.lang';

interface I18nState {
  lang: Lang;
  isRTL: boolean;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nState | null>(null);

async function applyRTLAndReload(lang: Lang) {
  const wantRTL = lang === 'ar';
  if (I18nManager.isRTL === wantRTL) return;
  I18nManager.allowRTL(wantRTL);
  I18nManager.forceRTL(wantRTL);
  // Layout direction only changes on relaunch; reload so mirroring applies now.
  try {
    await Updates.reloadAsync();
  } catch {
    // In Expo Go / dev where Updates.reloadAsync isn't available, the flip
    // takes effect on the next manual reload — no crash, just a delay.
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Seed from the current native layout direction so first render matches.
  const [lang, setLangState] = useState<Lang>(I18nManager.isRTL ? 'ar' : 'en');

  // Load persisted preference on mount and reconcile RTL if it drifted.
  useEffect(() => {
    SecureStore.getItemAsync(LANG_KEY).then((v) => {
      if (v === 'ar' || v === 'en') {
        setLangState(v);
        void applyRTLAndReload(v);
      }
    });
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    void SecureStore.setItemAsync(LANG_KEY, next);
    void applyRTLAndReload(next);
  }, []);

  const value = useMemo<I18nState>(
    () => ({
      lang,
      isRTL: lang === 'ar',
      setLang,
      t: (key, vars) => translate(lang, key, vars),
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
  return ctx;
}
