/**
 * Auth state for the parent app. Holds the JWT (persisted in secure storage)
 * and the phone-OTP flow. Only meaningful when `config.useBackend` is true; in
 * simulator mode the app runs without login.
 */

import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import * as api from '@/api/client';

const TOKEN_KEY = 'busmapp.token';
const PARENT_KEY = 'busmapp.parentId';

interface AuthState {
  token: string | null;
  parentId: string | null;
  /** True once we've finished reading persisted auth on launch. */
  ready: boolean;
  requestOtp: (phone: string) => Promise<{ devCode?: string }>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [t, p] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(PARENT_KEY),
        ]);
        setToken(t);
        setParentId(p);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      token,
      parentId,
      ready,
      requestOtp: async (phone) => {
        const res = await api.requestOtp(phone);
        return { devCode: res.devCode };
      },
      verifyOtp: async (phone, code) => {
        const res = await api.verifyOtp(phone, code);
        if (res.role !== 'parent' || !res.parentId) {
          throw new api.ApiError(403, 'This number is not a parent account.');
        }
        await Promise.all([
          SecureStore.setItemAsync(TOKEN_KEY, res.token),
          SecureStore.setItemAsync(PARENT_KEY, res.parentId),
        ]);
        setToken(res.token);
        setParentId(res.parentId);
      },
      signOut: async () => {
        await Promise.all([
          SecureStore.deleteItemAsync(TOKEN_KEY),
          SecureStore.deleteItemAsync(PARENT_KEY),
        ]);
        setToken(null);
        setParentId(null);
      },
    }),
    [token, parentId, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
