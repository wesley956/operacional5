import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { getPendingQueue, getQueueStats, type OfflineQueueRow, type OfflineQueueStats } from '../services/offline-queue';
import { getRecentMobileHistory, type MobileHistoryEvent } from '../services/mobile-data';

const emptyStats: OfflineQueueStats = { pending: 0, syncing: 0, synced: 0, failed: 0 };

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function kindLabel(kind: MobileHistoryEvent['kind']) {
  switch (kind) {
    case 'presence':
      return 'Assumir posto';
    case 'occurrence':
      return 'Ocorrência';
    case 'ronda':
      return 'Ronda';
    case 'handover':
      return 'Passagem';
    default:
      return 'Evento';
  }
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    valid: 'Válido',
    pending_review: 'Em revisão',
    rejected: 'Rejeitado',
    aberta: 'Aberta',
    resolvida: 'Resolvida',
    concluida: 'Concluída',
    pending: 'Pendente',
    failed: 'Falhou',
    syncing: 'Sincronizando',
    synced: 'Enviado',
  };

  return map[status] ?? status;
}

function statusStyle(status: string) {
  if (['valid', 'concluida', 'synced', 'resolvida'].includes(status)) return styles.badgeSuccess;
  if (['pending_review', 'pending', 'syncing'].includes(status)) return styles.badgeWarning;
  if (['rejected', 'failed'].includes(status)) return styles.badgeDanger;
  return styles.badgeDefault;
}

function gpsText(item: Pick<MobileHistoryEvent, 'gps_valid' | 'gps_lat' | 'gps_lng' | 'accuracy' | 'is_mock_location'>) {
  if (item.is_mock_location) return 'GPS suspeito/mock';
  if (typeof item.gps_lat !== 'number' || typeof item.gps_lng !== 'number') return 'Sem GPS';
  if (item.gps_valid === true) return item.accuracy ? `GPS válido · ±${Math.round(item.accuracy)}m` : 'GPS válido';
  if (item.gps_valid === false) return item.accuracy ? `GPS fora do raio · ±${Math.round(item.accuracy)}m` : 'GPS fora do raio';
  return item.accuracy ? `GPS registrado · ±${Math.round(item.accuracy)}m` : 'GPS registrado';
}

function safeJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function QueueCard({ item }: { item: OfflineQueueRow }) {
  const payload = safeJson(item.payload);
  const gpsLat = asNumber(payload.gps_lat);
  const gpsLng = asNumber(payload.gps_lng);
  const hasPhoto = Boolean(item.photo_url || payload.photo_url);
  const gpsValid = typeof payload.gps_valid === 'boolean' ? payload.gps_valid : null;

  return (
    <View style={styles.eventCard}>
      <View style={styles.eventHeader}>
        <View style={styles.eventHeaderText}>
          <Text style={styles.eventTitle}>{item.type === 'presence' ? 'Assumir posto pendente' : `${item.type.toUpperCase()} pendente`}</Text>
          <Text style={styles.eventMeta}>{formatDate(item.created_at)} · tentativas: {item.attempts}</Text>
        </View>
        <Text style={[styles.badge, statusStyle(item.status)]}>{statusLabel(item.status)}</Text>
      </View>

      <View style={styles.chips}>
        <Text style={styles.chip}>{gpsLat && gpsLng ? (gpsValid ? 'GPS válido' : 'GPS registrado') : 'Sem GPS'}</Text>
        <Text style={styles.chip}>{hasPhoto ? 'Foto anexada' : 'Sem foto'}</Text>
      </View>

      {item.last_error ? <Text style={styles.errorBox}>{item.last_error}</Text> : null}
    </View>
  );
}

function RemoteCard({ item }: { item: MobileHistoryEvent }) {
  const hasGps = typeof item.gps_lat === 'number' && typeof item.gps_lng === 'number';
  const mapUrl = hasGps ? `https://www.google.com/maps?q=${item.gps_lat},${item.gps_lng}` : null;

  return (
    <View style={styles.eventCard}>
      <View style={styles.eventHeader}>
        <View style={styles.eventHeaderText}>
          <Text style={styles.eventTitle}>{item.title}</Text>
          <Text style={styles.eventMeta}>{kindLabel(item.kind)} · {formatDate(item.created_at)}</Text>
        </View>
        <Text style={[styles.badge, statusStyle(item.status)]}>{statusLabel(item.status)}</Text>
      </View>

      <Text style={styles.eventDesc}>{item.description}</Text>

      <View style={styles.chips}>
        {item.employee_name ? <Text style={styles.chip}>Operador: {item.employee_name}</Text> : null}
        <Text style={styles.chip}>{gpsText(item)}</Text>
        <Text style={styles.chip}>{item.photo_url ? 'Foto enviada' : 'Sem foto'}</Text>
        {item.validation_method ? <Text style={styles.chip}>Método: {item.validation_method}</Text> : null}
      </View>

      {item.photo_url ? (
        <Pressable onPress={() => void Linking.openURL(item.photo_url ?? '')}>
          <Image source={{ uri: item.photo_url }} style={styles.photo} />
        </Pressable>
      ) : null}

      <View style={styles.actionsRow}>
        {mapUrl ? (
          <Pressable style={styles.smallButton} onPress={() => void Linking.openURL(mapUrl)}>
            <Text style={styles.smallButtonText}>Abrir mapa</Text>
          </Pressable>
        ) : null}

        {item.photo_url ? (
          <Pressable style={styles.smallButton} onPress={() => void Linking.openURL(item.photo_url ?? '')}>
            <Text style={styles.smallButtonText}>Abrir foto</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function HistoryScreen() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<OfflineQueueStats>(emptyStats);
  const [queue, setQueue] = useState<OfflineQueueRow[]>([]);
  const [remote, setRemote] = useState<MobileHistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const presenceEvents = useMemo(() => remote.filter(item => item.kind === 'presence'), [remote]);

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
    void load();
  }, [load]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Aparelho do posto</Text>
        <Text style={styles.title}>Histórico operacional</Text>
        <Text style={styles.subtitle}>Assunções de posto, eventos enviados e fila offline.</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Assumir posto</Text>
          <Text style={styles.statNumber}>{presenceEvents.length}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Pendentes</Text>
          <Text style={styles.statNumber}>{stats.pending}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Falhas</Text>
          <Text style={styles.statNumber}>{stats.failed}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Enviados</Text>
          <Text style={styles.statNumber}>{stats.synced}</Text>
        </View>
      </View>

      {error ? <Text style={styles.errorBox}>{error}</Text> : null}
      {loading ? <ActivityIndicator color="#1e40af" /> : null}

      <Text style={styles.sectionTitle}>Pendentes no aparelho</Text>
      {queue.length === 0 ? (
        <Text style={styles.empty}>Nenhum evento pendente. O aparelho está sincronizado.</Text>
      ) : (
        queue.map((item) => <QueueCard key={item.id} item={item} />)
      )}

      <Text style={styles.sectionTitle}>Últimos registros</Text>
      {remote.length === 0 ? (
        <Text style={styles.empty}>Nenhum histórico remoto encontrado.</Text>
      ) : (
        remote.map((item) => <RemoteCard key={`${item.kind}-${item.id}`} item={item} />)
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
  header: { gap: 5 },
  eyebrow: { color: '#1e40af', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  title: { fontSize: 26, fontWeight: '900', color: '#0f172a' },
  subtitle: { color: '#64748b', fontSize: 14, lineHeight: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flexGrow: 1, minWidth: '45%', backgroundColor: '#ffffff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  statLabel: { color: '#64748b', fontSize: 12, fontWeight: '800' },
  statNumber: { color: '#0f172a', fontSize: 24, fontWeight: '900', marginTop: 3 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginTop: 8 },
  eventCard: { backgroundColor: '#ffffff', borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  eventHeaderText: { flex: 1 },
  eventTitle: { fontWeight: '900', color: '#0f172a', fontSize: 16 },
  eventMeta: { color: '#64748b', fontSize: 12, marginTop: 2 },
  eventDesc: { color: '#334155', lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 9, fontSize: 12, fontWeight: '800' },
  badge: { borderRadius: 999, paddingVertical: 5, paddingHorizontal: 9, fontSize: 12, fontWeight: '900', overflow: 'hidden' },
  badgeSuccess: { backgroundColor: '#dcfce7', color: '#166534' },
  badgeWarning: { backgroundColor: '#fef3c7', color: '#92400e' },
  badgeDanger: { backgroundColor: '#fee2e2', color: '#991b1b' },
  badgeDefault: { backgroundColor: '#e2e8f0', color: '#334155' },
  photo: { width: '100%', height: 180, borderRadius: 14, backgroundColor: '#e2e8f0' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallButton: { borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12 },
  smallButtonText: { color: '#1e40af', fontWeight: '900' },
  empty: { color: '#64748b', backgroundColor: '#ffffff', borderRadius: 14, padding: 14 },
  errorBox: { color: '#b91c1c', backgroundColor: '#fee2e2', borderRadius: 14, padding: 12, fontWeight: '800' },
  secondaryButton: { borderWidth: 1, borderColor: '#1e40af', borderRadius: 14, padding: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#1e40af', fontWeight: '900' },
});
