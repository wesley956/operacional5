import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { createOccurrence, getTodaySchedules, type MobileSchedule } from '../services/mobile-data';
import { captureEvidencePhoto, pickEvidenceFromLibrary, uploadEvidencePhoto, type EvidenceAsset } from '../services/evidence';
import { getCurrentLocation } from '../services/location';

type OccurrenceType = 'furto' | 'acidente' | 'invasao' | 'dano' | 'briga' | 'suspeito' | 'outro';
type Severity = 'baixa' | 'media' | 'alta' | 'critica';

const types: OccurrenceType[] = ['suspeito', 'dano', 'invasao', 'acidente', 'briga', 'furto', 'outro'];
const severities: Severity[] = ['baixa', 'media', 'alta', 'critica'];

export function OccurrenceScreen() {
  const { profile } = useAuth();
  const [schedules, setSchedules] = useState<MobileSchedule[]>([]);
  const [selected, setSelected] = useState<MobileSchedule | null>(null);
  const [type, setType] = useState<OccurrenceType>('suspeito');
  const [severity, setSeverity] = useState<Severity>('media');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<EvidenceAsset | null>(null);
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

  async function takePhoto() {
    setError(null);
    try {
      const asset = await captureEvidencePhoto();
      if (asset) setPhoto(asset);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function choosePhoto() {
    setError(null);
    try {
      const asset = await pickEvidenceFromLibrary();
      if (asset) setPhoto(asset);
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
      const location = await getCurrentLocation().catch(() => null);
      const photoUrl = photo ? await uploadEvidencePhoto({ companyId: profile.company_id, asset: photo, prefix: 'occurrence' }) : null;
      const result = await createOccurrence({ profile, schedule: selected, location, type, severity, description, photoUrl });
      setDescription('');
      setPhoto(null);
      setMessage(result.queued ? 'Ocorrência salva offline para sincronização.' : `Ocorrência registrada: ${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Registrar ocorrência</Text>
      {loading ? <ActivityIndicator color="#1e40af" /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Text style={styles.label}>Posto</Text>
      {schedules.map((schedule) => (
        <Pressable key={schedule.id} onPress={() => setSelected(schedule)} style={[styles.card, selected?.id === schedule.id && styles.selected]}>
          <Text style={styles.postName}>{schedule.post.name}</Text>
          <Text style={styles.address}>{schedule.post.address}</Text>
        </Pressable>
      ))}

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.grid}>
        {types.map((item) => (
          <Pressable key={item} onPress={() => setType(item)} style={[styles.chip, type === item && styles.chipActive]}>
            <Text style={[styles.chipText, type === item && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Gravidade</Text>
      <View style={styles.grid}>
        {severities.map((item) => (
          <Pressable key={item} onPress={() => setSeverity(item)} style={[styles.chip, severity === item && styles.chipActive]}>
            <Text style={[styles.chipText, severity === item && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Descrição</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Descreva o que aconteceu..."
        multiline
        style={styles.textarea}
      />

      <View style={styles.photoCard}>
        <Text style={styles.label}>Foto/evidência</Text>
        <Text style={styles.photoText}>{photo ? `Foto selecionada: ${photo.fileName}` : 'Opcional, mas recomendado.'}</Text>
        <View style={styles.row}>
          <Pressable style={[styles.secondaryButton, styles.flex]} onPress={takePhoto}>
            <Text style={styles.secondaryButtonText}>Câmera</Text>
          </Pressable>
          <Pressable style={[styles.secondaryButton, styles.flex]} onPress={choosePhoto}>
            <Text style={styles.secondaryButtonText}>Galeria</Text>
          </Pressable>
        </View>
      </View>

      <Pressable disabled={!selected || submitting || description.trim().length < 5} onPress={submit} style={[styles.primaryButton, (!selected || submitting || description.trim().length < 5) && styles.disabled]}>
        {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Salvar ocorrência</Text>}
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
  label: { fontWeight: '900', color: '#334155', marginTop: 4 },
  card: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 16 },
  selected: { borderColor: '#2563eb', borderWidth: 2 },
  postName: { fontSize: 17, fontWeight: '900', color: '#0f172a' },
  address: { color: '#64748b', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1' },
  chipActive: { backgroundColor: '#1e40af', borderColor: '#1e40af' },
  chipText: { color: '#334155', fontWeight: '800' },
  chipTextActive: { color: '#ffffff' },
  textarea: { minHeight: 120, backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#cbd5e1', padding: 14, textAlignVertical: 'top', fontSize: 16 },
  photoCard: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, gap: 10 },
  photoText: { color: '#475569', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  primaryButton: { backgroundColor: '#1e40af', borderRadius: 16, padding: 16, alignItems: 'center' },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  secondaryButton: { backgroundColor: '#ffffff', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1' },
  secondaryButtonText: { color: '#0f172a', fontWeight: '900' },
  disabled: { opacity: 0.55 },
  error: { color: '#b91c1c', backgroundColor: '#fee2e2', padding: 12, borderRadius: 12 },
  success: { color: '#166534', backgroundColor: '#dcfce7', padding: 12, borderRadius: 12, fontWeight: '800' },
  backButton: { alignItems: 'center', padding: 14 },
  backText: { color: '#64748b', fontWeight: '800' },
});
