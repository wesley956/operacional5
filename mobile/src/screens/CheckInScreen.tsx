import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { confirmPresence, getTodaySchedules, type MobileSchedule } from '../services/mobile-data';
import { getCurrentLocation, isWithinGeofence, type LocationResult } from '../services/location';

export function CheckInScreen() {
  const { profile } = useAuth();
  const [schedules, setSchedules] = useState<MobileSchedule[]>([]);
  const [selected, setSelected] = useState<MobileSchedule | null>(null);
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
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

  async function captureLocation() {
    setError(null);
    setMessage(null);
    try {
      setLocation(await getCurrentLocation());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submit() {
    if (!profile || !selected) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const currentLocation = location ?? await getCurrentLocation();
      setLocation(currentLocation);
      const gpsValid = isWithinGeofence(
        currentLocation.lat,
        currentLocation.lng,
        selected.post.lat,
        selected.post.lng,
        selected.post.radius_meters
      );

      const result = await confirmPresence({ profile, schedule: selected, location: currentLocation, gpsValid });
      setMessage(`Check-in registrado com status: ${result.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Check-in GPS</Text>
      {loading ? <ActivityIndicator color="#1e40af" /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      {schedules.map((schedule) => (
        <Pressable key={schedule.id} onPress={() => setSelected(schedule)} style={[styles.card, selected?.id === schedule.id && styles.selected]}>
          <Text style={styles.postName}>{schedule.post.name}</Text>
          <Text style={styles.address}>{schedule.post.address}</Text>
          <Text style={styles.radius}>Raio permitido: {schedule.post.radius_meters}m</Text>
        </Pressable>
      ))}

      {!loading && schedules.length === 0 ? <Text style={styles.empty}>Nenhuma escala disponível para check-in hoje.</Text> : null}

      {location ? (
        <View style={styles.locationBox}>
          <Text style={styles.locationText}>GPS: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}</Text>
          <Text style={styles.locationText}>Acurácia: {Math.round(location.accuracy)}m</Text>
          <Text style={styles.locationText}>Mock suspeito: {location.isMock ? 'sim' : 'não'}</Text>
        </View>
      ) : null}

      <Pressable style={styles.secondaryButton} onPress={captureLocation}>
        <Text style={styles.secondaryButtonText}>Capturar localização</Text>
      </Pressable>

      <Pressable disabled={!selected || submitting} style={[styles.primaryButton, (!selected || submitting) && styles.disabled]} onPress={submit}>
        {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Confirmar presença</Text>}
      </Pressable>

      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>Voltar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, gap: 14 },
  title: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  card: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 16 },
  selected: { borderColor: '#2563eb', borderWidth: 2 },
  postName: { fontSize: 17, fontWeight: '900', color: '#0f172a' },
  address: { color: '#64748b', marginTop: 4 },
  radius: { color: '#1e40af', marginTop: 8, fontWeight: '800' },
  locationBox: { backgroundColor: '#e0f2fe', padding: 14, borderRadius: 16 },
  locationText: { color: '#075985', fontWeight: '700' },
  primaryButton: { backgroundColor: '#1e40af', borderRadius: 16, padding: 16, alignItems: 'center' },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  secondaryButton: { backgroundColor: '#ffffff', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1' },
  secondaryButtonText: { color: '#0f172a', fontWeight: '900' },
  disabled: { opacity: 0.55 },
  error: { color: '#b91c1c', backgroundColor: '#fee2e2', padding: 12, borderRadius: 12 },
  success: { color: '#166534', backgroundColor: '#dcfce7', padding: 12, borderRadius: 12, fontWeight: '800' },
  empty: { color: '#64748b', backgroundColor: '#ffffff', padding: 16, borderRadius: 14 },
  backButton: { alignItems: 'center', padding: 14 },
  backText: { color: '#64748b', fontWeight: '800' },
});
