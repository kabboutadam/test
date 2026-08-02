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
const ROLE_KEY = 'busmapp.role';
const SCHOOL_KEY = 'busmapp.schoolId';

export type AuthRole = 'parent' | 'operator';

interface AuthState {
  token: string | null;
  parentId: string | null;
  /** 'operator' when a school is logged in, 'parent' for a family, else null. */
  role: AuthRole | null;
  /** The operator's school id (only set for operator logins). */
  schoolId: string | null;
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
  const [role, setRole] = useState<AuthRole | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [t, p, r, s] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(PARENT_KEY),
          SecureStore.getItemAsync(ROLE_KEY),
          SecureStore.getItemAsync(SCHOOL_KEY),
        ]);
        setToken(t);
        setParentId(p);
        setRole(r === 'operator' || r === 'parent' ? r : null);
        setSchoolId(s);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      token,
      parentId,
      role,
      schoolId,
      ready,
      requestOtp: async (phone) => {
        const res = await api.requestOtp(phone);
        return { devCode: res.devCode };
      },
      verifyOtp: async (phone, code) => {
        const res = await api.verifyOtp(phone, code);
        if (res.role === 'parent' && res.parentId) {
          await Promise.all([
            SecureStore.setItemAsync(TOKEN_KEY, res.token),
            SecureStore.setItemAsync(PARENT_KEY, res.parentId),
            SecureStore.setItemAsync(ROLE_KEY, 'parent'),
            SecureStore.deleteItemAsync(SCHOOL_KEY),
          ]);
          setParentId(res.parentId);
          setSchoolId(null);
          setRole('parent');
          setToken(res.token);
        } else if (res.role === 'operator' && res.schoolId) {
          await Promise.all([
            SecureStore.setItemAsync(TOKEN_KEY, res.token),
            SecureStore.setItemAsync(SCHOOL_KEY, res.schoolId),
            SecureStore.setItemAsync(ROLE_KEY, 'operator'),
            SecureStore.deleteItemAsync(PARENT_KEY),
          ]);
          setSchoolId(res.schoolId);
          setParentId(null);
          setRole('operator');
          setToken(res.token);
        } else {
          throw new api.ApiError(403, 'This number is not a parent or school account.');
        }
      },
      signOut: async () => {
        await Promise.all([
          SecureStore.deleteItemAsync(TOKEN_KEY),
          SecureStore.deleteItemAsync(PARENT_KEY),
          SecureStore.deleteItemAsync(ROLE_KEY),
          SecureStore.deleteItemAsync(SCHOOL_KEY),
        ]);
        setToken(null);
        setParentId(null);
        setRole(null);
        setSchoolId(null);
      },
    }),
    [token, parentId, role, schoolId, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
