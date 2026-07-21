/**
 * Global app state. Owns the current parent, their children, the live bus
 * positions (fed by the simulator), and the subscription. UI components read
 * from here via the useApp() hook and never touch the simulator directly.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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

interface AppState {
  parent: Parent;
  children: Child[];
  buses: Bus[];
  positions: Record<string, BusPosition>;
  subscription: Subscription;
  subscribe: (planId: Plan['id']) => void;
  resetSimulation: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const simulatorRef = useRef<BusSimulator | null>(null);
  const [positions, setPositions] = useState<Record<string, BusPosition>>({});
  const [subscription, setSubscription] =
    useState<Subscription>(initialSubscription);

  if (simulatorRef.current == null) {
    simulatorRef.current = new BusSimulator(routes);
  }

  useEffect(() => {
    const sim = simulatorRef.current!;
    const unsubscribe = sim.subscribe(setPositions);
    sim.start();
    return () => {
      unsubscribe();
      sim.stop();
    };
  }, []);

  const value = useMemo<AppState>(
    () => ({
      parent,
      children: allChildren,
      buses,
      positions,
      subscription,
      subscribe: (planId: Plan['id']) => setSubscription(activatePlan(planId)),
      resetSimulation: () => simulatorRef.current?.reset(),
    }),
    [positions, subscription],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within an AppProvider');
  return ctx;
}
