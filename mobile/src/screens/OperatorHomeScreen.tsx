import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useSyncStatus } from '../context/SyncContext';
import { getTodaySchedules, type MobileSchedule } from '../services/mobile-data';
import { FieldSideMenu } from '../components/FieldSideMenu';

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatLastSync(value: string | null) {
  if (!value) return 'Ainda não sincronizou nesta sessão';
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function OperatorHomeScreen() {
  const { profile, signOut } = useAuth();
  const sync = useSyncStatus();
  const [menuOpen, setMenuOpen] = useState(false);
  const [schedules, setSchedules] = useState<MobileSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setError(null);
    setLoading(true);
    try {
      setSchedules(await getTodaySchedules(profile.id));
      await sync.refreshStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [profile?.id, sync.refreshStats]);

  useEffect(() => { void load(); }, [load]);

  async function logout() {
    await signOut();
    router.replace('/login');
  }

  const pendingTotal = sync.stats.pending + sync.stats.failed + sync.stats.syncing;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <FieldSideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />

      <View style={styles.topBar}>
        <Pressable style={styles.menuButton} onPress={() => setMenuOpen(true)}>
          <Text style={styles.menuButtonText}>☰ Menu</Text>
        </Pressable>
        <Text style={styles.topBarText}>Operação de campo</Text>
      </View>

      <View style={styles.headerCard}>
        <Text style={styles.kicker}>Bem-vindo</Text>
        <Text style={styles.title}>{profile?.name ?? 'Operador'}</Text>
        <Text style={styles.role}>{profile?.role?.toUpperCase() ?? 'USUÁRIO'}</Text>
      </View>

      <View style={[styles.syncCard, sync.isOnline ? styles.onlineCard : styles.offlineCard]}>
        <View style={styles.syncHeader}>
          <Text style={styles.syncTitle}>{sync.isOnline ? 'Online' : 'Offline'}</Text>
          <Text style={styles.syncBadge}>{sync.syncing ? 'Sincronizando...' : `${pendingTotal} pendente(s)`}</Text>
        </View>
        <Text style={styles.syncText}>Última sincronização: {formatLastSync(sync.lastSyncAt)}</Text>
        {sync.error ? <Text style={styles.syncError}>{sync.error}</Text> : null}
        <Pressable style={styles.syncButton} onPress={() => void sync.syncNow()} disabled={sync.syncing || !sync.isOnline}>
          <Text style={styles.syncButtonText}>Sincronizar agora</Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable style={[styles.actionButton, styles.primary]} onPress={() => router.push('/check-in')}>
          <Text style={styles.actionText}>Fazer check-in</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.danger]} onPress={() => router.push('/sos')}>
          <Text style={styles.actionText}>SOS</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.secondary]} onPress={() => router.push('/occurrence')}>
          <Text style={styles.actionTextDark}>Ocorrência</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.secondary]} onPress={() => router.push('/ronda')}>
          <Text style={styles.actionTextDark}>Ronda QR</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.secondary]} onPress={() => router.push('/qr-scan')}>
          <Text style={styles.actionTextDark}>Leitor QR</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Escala de hoje</Text>
      {loading ? <ActivityIndicator color="#1e40af" /> : null}
      
      <View style={styles.quickActions}>
        <Pressable style={styles.secondaryButton} onPress={() => router.push('/handover')}>
          <Text style={styles.secondaryButtonText}>Passagem de plantão</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.push('/history')}>
          <Text style={styles.secondaryButtonText}>Histórico</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.push('/profile')}>
          <Text style={styles.secondaryButtonText}>Perfil</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && schedules.length === 0 ? <Text style={styles.empty}>Nenhuma escala encontrada para hoje.</Text> : null}

      {schedules.map((schedule) => (
        <View key={schedule.id} style={styles.scheduleCard}>
          <Text style={styles.postName}>{schedule.post.name}</Text>
          <Text style={styles.address}>{schedule.post.address}</Text>
          <Text style={styles.shift}>{formatTime(schedule.shift_start)} → {formatTime(schedule.shift_end)}</Text>
          {schedule.post.require_ronda ? <Text style={styles.rondaRequired}>Ronda obrigatória neste posto</Text> : null}
          {schedule.post.require_photo ? <Text style={styles.rondaRequired}>Foto obrigatória no check-in</Text> : null}
        </View>
      ))}

      <Pressable style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>Sair</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  topBarText: { color: '#64748b', fontWeight: '800' },
  menuButton: { backgroundColor: '#1e40af', borderRadius: 14, paddingVertical: 11, paddingHorizontal: 16 },
  menuButtonText: { color: '#ffffff', fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#1e40af', borderRadius: 14, padding: 14, alignItems: 'center', backgroundColor: '#ffffff' },
  secondaryButtonText: { color: '#1e40af', fontWeight: '800' },
  quickActions: { display: 'none' },
  page: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, gap: 16 },
  headerCard: { backgroundColor: '#0f172a', borderRadius: 24, padding: 20 },
  kicker: { color: '#93c5fd', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: '#ffffff', fontSize: 26, fontWeight: '900', marginTop: 4 },
  role: { color: '#cbd5e1', marginTop: 6, fontWeight: '800' },
  syncCard: { borderRadius: 20, padding: 16, borderWidth: 1 },
  onlineCard: { backgroundColor: '#ecfdf5', borderColor: '#86efac' },
  offlineCard: { backgroundColor: '#fff7ed', borderColor: '#fdba74' },
  syncHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  syncTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900' },
  syncBadge: { color: '#334155', fontWeight: '900' },
  syncText: { color: '#475569', marginTop: 6 },
  syncError: { color: '#b91c1c', marginTop: 8, fontWeight: '700' },
  syncButton: { marginTop: 12, backgroundColor: '#0f172a', borderRadius: 12, padding: 12, alignItems: 'center' },
  syncButtonText: { color: '#ffffff', fontWeight: '900' },
  actions: { gap: 10 },
  actionButton: { borderRadius: 18, padding: 16, alignItems: 'center' },
  primary: { backgroundColor: '#1e40af' },
  danger: { backgroundColor: '#dc2626' },
  secondary: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1' },
  actionText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  actionTextDark: { color: '#0f172a', fontSize: 16, fontWeight: '900' },
  sectionTitle: { fontSize: 19, fontWeight: '900', color: '#0f172a' },
  scheduleCard: { backgroundColor: '#ffffff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  postName: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  address: { color: '#64748b', marginTop: 4 },
  shift: { color: '#1e40af', fontWeight: '900', marginTop: 8 },
  rondaRequired: { color: '#92400e', backgroundColor: '#fef3c7', padding: 8, borderRadius: 10, marginTop: 8, fontWeight: '800' },
  error: { color: '#b91c1c', backgroundColor: '#fee2e2', padding: 12, borderRadius: 12 },
  empty: { color: '#64748b', backgroundColor: '#ffffff', padding: 16, borderRadius: 14 },
  logout: { padding: 16, alignItems: 'center' },
  logoutText: { color: '#64748b', fontWeight: '900' },
});
