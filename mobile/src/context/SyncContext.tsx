import NetInfo from '@react-native-community/netinfo';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  clearSyncedEvents,
  getQueueStats,
  OfflineQueueStats,
  syncOfflineQueue,
} from '../services/offline-queue';

interface SyncContextValue {
  stats: OfflineQueueStats;
  isOnline: boolean;
  syncing: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  error: string | null;
  refreshStats: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const initialStats: OfflineQueueStats = {
  pending: 0,
  syncing: 0,
  synced: 0,
  failed: 0,
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<OfflineQueueStats>(initialStats);
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStats = useCallback(async () => {
    const nextStats = await getQueueStats();
    setStats(nextStats);
  }, []);

  const syncNow = useCallback(async () => {
    if (syncing) return;

    setSyncing(true);
    setError(null);

    try {
      await syncOfflineQueue();
      await clearSyncedEvents(7);
      setLastSyncAt(new Date().toISOString());
      await refreshStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }, [refreshStats, syncing]);

  useEffect(() => {
    let mounted = true;

    refreshStats().catch((err) => {
      if (mounted) setError(err instanceof Error ? err.message : String(err));
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      if (mounted) setIsOnline(online);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [refreshStats]);

  useEffect(() => {
    if (!isOnline) return;

    const hasPending = stats.pending > 0 || stats.failed > 0;
    if (!hasPending) return;

    syncNow();
    // Não coloque stats como dependência aqui, senão o sync cria loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  const value = useMemo<SyncContextValue>(
    () => ({
      stats,
      isOnline,
      syncing,
      isSyncing: syncing,
      lastSyncAt,
      error,
      refreshStats,
      syncNow,
    }),
    [stats, isOnline, syncing, lastSyncAt, error, refreshStats, syncNow]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync deve ser usado dentro de SyncProvider');
  }
  return context;
}

export function useSyncStatus() {
  return useSync();
}
