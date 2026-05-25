import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { clearSyncedEvents, getQueueStats, syncOfflineQueue, type OfflineQueueStats } from '../services/offline-queue';

interface SyncContextValue {
  isOnline: boolean;
  syncing: boolean;
  stats: OfflineQueueStats;
  lastSyncAt: string | null;
  error: string | null;
  refreshStats: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const emptyStats: OfflineQueueStats = { pending: 0, syncing: 0, synced: 0, failed: 0 };
const SyncContext = createContext<SyncContextValue | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { session, profile } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState<OfflineQueueStats>(emptyStats);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStats = useCallback(async () => {
    setStats(await getQueueStats());
  }, []);

  const syncNow = useCallback(async () => {
    if (!session || !profile || !isOnline || syncing) {
      await refreshStats().catch(() => undefined);
      return;
    }

    setSyncing(true);
    setError(null);
    try {
      await syncOfflineQueue();
      await clearSyncedEvents(7);
      setLastSyncAt(new Date().toISOString());
      await refreshStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await refreshStats().catch(() => undefined);
    } finally {
      setSyncing(false);
    }
  }, [isOnline, profile, refreshStats, session, syncing]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const nextOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(nextOnline);
      if (nextOnline) void syncNow();
    });

    void refreshStats();
    return unsubscribe;
  }, [refreshStats, syncNow]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshStats();
        void syncNow();
      }
    });
    return () => sub.remove();
  }, [refreshStats, syncNow]);

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshStats();
      void syncNow();
    }, 30000);
    return () => clearInterval(timer);
  }, [refreshStats, syncNow]);

  const value = useMemo(
    () => ({ isOnline, syncing, stats, lastSyncAt, error, refreshStats, syncNow }),
    [error, isOnline, lastSyncAt, refreshStats, stats, syncNow, syncing]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSyncStatus() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncStatus precisa ser usado dentro de SyncProvider');
  return ctx;
}
