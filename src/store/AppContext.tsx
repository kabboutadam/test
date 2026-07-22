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
  initialSubscription,
  parent,
  routes,
} from '@/data/mockData';
import { Bus, BusPosition, Child, Parent, Subscription } from '@/models/types';
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
  subscribe: (planId: Plan['id']) => void;
  resetSimulation: () => void;
}

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

  // Pick the position source once. BusSimulator satisfies PositionSource
  // structurally, so both branches expose the same start/stop/subscribe/reset.
  if (sourceRef.current == null) {
    sourceRef.current = config.useBackend
      ? new BackendPositionSource(routes.map((r) => r.id))
      : new BusSimulator(routes);
  }

  useEffect(() => {
    const source = sourceRef.current!;
    const unsubscribe = source.subscribe(setPositions);
    source.start();
    return () => {
      unsubscribe();
      source.stop();
    };
  }, []);

  // Load live children + subscription from the API in backend mode.
  useEffect(() => {
    if (!config.useBackend || !token) return;
    let active = true;
    (async () => {
      try {
        const [kids, sub] = await Promise.all([
          api.fetchChildren(token),
          api.fetchSubscription(token),
        ]);
        if (!active) return;
        setChildList(kids);
        setSubscription(sub);
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
      subscribe: async (planId: Plan['id']) => {
        if (config.useBackend && token) {
          setSubscription(await api.activateSubscription(token, planId));
        } else {
          setSubscription(activatePlan(planId));
        }
      },
      resetSimulation: () => sourceRef.current?.reset(),
    }),
    [childList, positions, subscription, token],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within an AppProvider');
  return ctx;
}
