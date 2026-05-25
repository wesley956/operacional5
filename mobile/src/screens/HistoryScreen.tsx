import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { getPendingQueue, getQueueStats, type OfflineQueueRow, type OfflineQueueStats } from '../services/offline-queue';
import { getRecentMobileHistory, type MobileHistoryEvent } from '../services/mobile-data';

const emptyStats: OfflineQueueStats = { pending: 0, syncing: 0, synced: 0, failed: 0 };

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function HistoryScreen() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<OfflineQueueStats>(emptyStats);
  const [queue, setQueue] = useState<OfflineQueueRow[]>([]);
  const [remote, setRemote] = useState<MobileHistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setError(null);
    setLoading(true);
    try {
      const [nextStats, nextQueue, nextRemote] = await Promise.all([
        getQueueStats(),
        getPendingQueue(20),
        getRecentMobileHistory(profile),
      ]);
      setStats(nextStats);
      setQueue(nextQueue);
      setRemote(nextRemote);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Histórico operacional</Text>
        <Text style={styles.subtitle}>Eventos enviados, pendentes e sincronizados.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fila offline</Text>
        <View style={styles.statsGrid}>
          <Text style={styles.stat}>Pendentes: {stats.pending}</Text>
          <Text style={styles.stat}>Falhas: {stats.failed}</Text>
          <Text style={styles.stat}>Sincronizando: {stats.syncing}</Text>
          <Text style={styles.stat}>Enviados: {stats.synced}</Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color="#1e40af" /> : null}

      <Text style={styles.sectionTitle}>Pendentes no aparelho</Text>
      {queue.length === 0 ? (
        <Text style={styles.empty}>Nenhum evento pendente.</Text>
      ) : (
        queue.map((item) => (
          <View key={item.id} style={styles.eventCard}>
            <Text style={styles.eventTitle}>{item.type.toUpperCase()} · {item.status}</Text>
            <Text style={styles.eventMeta}>{formatDate(item.created_at)} · tentativas: {item.attempts}</Text>
            {item.last_error ? <Text style={styles.error}>{item.last_error}</Text> : null}
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Últimos eventos enviados</Text>
      {remote.length === 0 ? (
        <Text style={styles.empty}>Nenhum histórico remoto encontrado.</Text>
      ) : (
        remote.map((item) => (
          <View key={`${item.kind}-${item.id}`} style={styles.eventCard}>
            <Text style={styles.eventTitle}>{item.title}</Text>
            <Text style={styles.eventMeta}>{formatDate(item.created_at)} · {item.status}</Text>
            <Text style={styles.eventDesc}>{item.description}</Text>
          </View>
        ))
      )}

      <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonText}>Voltar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, gap: 16 },
  header: { gap: 6 },
  title: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  subtitle: { color: '#64748b', fontSize: 14 },
  card: { backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  statsGrid: { gap: 6 },
  stat: { color: '#334155', fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginTop: 8 },
  eventCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 14, gap: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  eventTitle: { fontWeight: '800', color: '#0f172a' },
  eventMeta: { color: '#64748b', fontSize: 12 },
  eventDesc: { color: '#334155' },
  empty: { color: '#64748b', backgroundColor: '#ffffff', borderRadius: 14, padding: 14 },
  error: { color: '#b91c1c', fontWeight: '700' },
  secondaryButton: { borderWidth: 1, borderColor: '#1e40af', borderRadius: 14, padding: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#1e40af', fontWeight: '800' },
});
