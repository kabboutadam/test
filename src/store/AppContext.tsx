/**
 * Global app state. Owns the current parent, their children, the live bus
 * positions, and the subscription.
 *
 * In simulator mode (config.useBackend = false) everything comes from mock data
 * and the local BusSimulator. In backend mode it reads children + subscription
 * from the authenticated API and positions from the server socket. The UI is
 * identical either way.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as api from '@/api/client';
import { config } from '@/api/config';
import { BackendPositionSource, PositionSource } from '@/api/positionSource';
import {
  buses,
  children as allChildren,
  currentSession,
  initialSubscription,
  parent,
  routes,
  setRoutes,
} from '@/data/mockData';
import {
  Bus,
  BusPosition,
  Child,
  Parent,
  RouteSession,
  Subscription,
} from '@/models/types';
import { BusSimulator } from '@/services/busSimulator';
import { activate as activatePlan, Plan } from '@/services/subscription';
import { useAuth } from '@/store/AuthContext';

interface AppState {
  parent: Parent;
  children: Child[];
  buses: Bus[];
  positions: Record<string, BusPosition>;
  subscription: Subscription;
  /** 'backend' when reading live positions from the API, else 'simulator'. */
  positionMode: 'backend' | 'simulator';
  /** Morning pickup vs afternoon drop-off — which run the UI is tracking. */
  session: RouteSession;
  setSession: (session: RouteSession) => void;
  subscribe: (planId: Plan['id']) => void;
  addChild: (input: api.NewChild) => Promise<void>;
  updateChild: (id: string, patch: api.ChildPatch) => Promise<void>;
  removeChild: (id: string) => Promise<void>;
  resetSimulation: () => void;
}

const CHILD_COLORS = ['#0B6E4F', '#C1440E', '#2A6F97', '#8E44AD', '#B7791F'];

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { token, signOut } = useAuth();
  const sourceRef = useRef<PositionSource | null>(null);
  const [positions, setPositions] = useState<Record<string, BusPosition>>({});
  const [childList, setChildList] = useState<Child[]>(
    config.useBackend ? [] : allChildren,
  );
  const [subscription, setSubscription] = useState<Subscription>(
    config.useBackend
      ? { status: 'none', plan: null, renewsAt: null }
      : initialSubscription,
  );
  // Default to the run that matches the time of day; the parent can switch.
  const [session, setSession] = useState<RouteSession>(currentSession());
  // In backend mode we must load the server's routes before tracking; in
  // simulator mode the seed routes are ready immediately.
  const [routesReady, setRoutesReady] = useState(!config.useBackend);

  // Wire up the position source. In simulator mode this runs once. In backend
  // mode it (re)connects whenever the auth token changes — the token is sent in
  // the socket handshake so the server can authorize the subscription.
  useEffect(() => {
    let source: PositionSource;
    if (config.useBackend) {
      if (!token || !routesReady) return; // wait for login + server routes
      source = new BackendPositionSource(routes.map((r) => r.id), token);
    } else {
      source = new BusSimulator(routes);
    }
    sourceRef.current = source;
    const unsubscribe = source.subscribe(setPositions);
    source.start();
    return () => {
      unsubscribe();
      source.stop();
      sourceRef.current = null;
    };
  }, [token, routesReady]);

  // Load live routes + children + subscription from the API in backend mode.
  // Routes must land first (setRoutes) so lookups resolve real school routes.
  useEffect(() => {
    if (!config.useBackend || !token) return;
    let active = true;
    (async () => {
      try {
        const [serverRoutes, kids, sub] = await Promise.all([
          api.fetchRoutes(),
          api.fetchChildren(token),
          api.fetchSubscription(token),
        ]);
        if (!active) return;
        setRoutes(serverRoutes);
        setChildList(kids);
        setSubscription(sub);
        setRoutesReady(true);
      } catch (err) {
        if (err instanceof api.ApiError && err.status === 401) await signOut();
      }
    })();
    return () => {
      active = false;
    };
  }, [token, signOut]);

  const value = useMemo<AppState>(
    () => ({
      parent,
      children: childList,
      buses,
      positions,
      subscription,
      positionMode: config.useBackend ? 'backend' : 'simulator',
      session,
      setSession,
      subscribe: async (planId: Plan['id']) => {
        if (config.useBackend && token) {
          // Real billing: create a checkout, then confirm the payment. The
          // subscription only activates once the payment is confirmed paid.
          const { paymentId } = await api.createCheckout(token, planId);
          setSubscription(await api.confirmPayment(token, paymentId));
        } else {
          setSubscription(activatePlan(planId));
        }
      },
      addChild: async (input: api.NewChild) => {
        if (config.useBackend && token) {
          const created = await api.createChild(token, input);
          setChildList((prev) => [...prev, created]);
        } else {
          setChildList((prev) => [
            ...prev,
            {
              id: `child_local_${Date.now()}`,
              color: CHILD_COLORS[prev.length % CHILD_COLORS.length],
              parentId: parent.id,
              ...input,
            },
          ]);
        }
      },
      updateChild: async (id: string, patch: api.ChildPatch) => {
        if (config.useBackend && token) {
          const updated = await api.updateChild(token, id, patch);
          setChildList((prev) => prev.map((c) => (c.id === id ? updated : c)));
        } else {
          setChildList((prev) =>
            prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          );
        }
      },
      removeChild: async (id: string) => {
        if (config.useBackend && token) await api.deleteChild(token, id);
        setChildList((prev) => prev.filter((c) => c.id !== id));
      },
      resetSimulation: () => sourceRef.current?.reset(),
    }),
    [childList, positions, subscription, session, token],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within an AppProvider');
  return ctx;
}
