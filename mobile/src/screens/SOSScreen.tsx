import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { createOccurrence, getTodaySchedules, type MobileSchedule } from '../services/mobile-data';
import { getCurrentLocation } from '../services/location';

export function SOSScreen() {
  const { profile } = useAuth();
  const [schedules, setSchedules] = useState<MobileSchedule[]>([]);
  const [selected, setSelected] = useState<MobileSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const next = await getTodaySchedules(profile.id);
      setSchedules(next);
      setSelected(next[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { void load(); }, [load]);

  async function triggerSOS() {
    if (!profile || !selected) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      Vibration.vibrate([0, 300, 150, 300]);
      const location = await getCurrentLocation();
      const result = await createOccurrence({
        profile,
        schedule: selected,
        location,
        type: 'sos',
        severity: 'critica',
        description: `SOS acionado pelo app mobile no posto ${selected.post.name}.`,
      });
      setMessage(`SOS registrado. Ocorrência: ${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.warningCard}>
        <Text style={styles.title}>SOS de emergência</Text>
        <Text style={styles.description}>Use apenas em situação crítica. O sistema criará uma ocorrência crítica com sua localização.</Text>
      </View>

      {loading ? <ActivityIndicator color="#dc2626" /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      {schedules.map((schedule) => (
        <Pressable key={schedule.id} onPress={() => setSelected(schedule)} style={[styles.card, selected?.id === schedule.id && styles.selected]}>
          <Text style={styles.postName}>{schedule.post.name}</Text>
          <Text style={styles.address}>{schedule.post.address}</Text>
        </Pressable>
      ))}

      {!loading && schedules.length === 0 ? <Text style={styles.empty}>Nenhuma escala encontrada para acionar SOS.</Text> : null}

      <Pressable disabled={!selected || submitting} onPress={triggerSOS} style={[styles.sosButton, (!selected || submitting) && styles.disabled]}>
        {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.sosText}>ACIONAR SOS</Text>}
      </Pressable>

      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>Voltar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fef2f2' },
  content: { padding: 16, gap: 14 },
  warningCard: { backgroundColor: '#991b1b', borderRadius: 22, padding: 20 },
  title: { color: '#ffffff', fontSize: 24, fontWeight: '900' },
  description: { color: '#fee2e2', marginTop: 8, lineHeight: 20 },
  card: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#fecaca', padding: 16 },
  selected: { borderColor: '#dc2626', borderWidth: 2 },
  postName: { fontSize: 17, fontWeight: '900', color: '#0f172a' },
  address: { color: '#64748b', marginTop: 4 },
  sosButton: { backgroundColor: '#dc2626', borderRadius: 999, minHeight: 160, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  sosText: { color: '#ffffff', fontSize: 28, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  error: { color: '#b91c1c', backgroundColor: '#fee2e2', padding: 12, borderRadius: 12 },
  success: { color: '#166534', backgroundColor: '#dcfce7', padding: 12, borderRadius: 12, fontWeight: '800' },
  empty: { color: '#64748b', backgroundColor: '#ffffff', padding: 16, borderRadius: 14 },
  backButton: { alignItems: 'center', padding: 14 },
  backText: { color: '#64748b', fontWeight: '800' },
});
