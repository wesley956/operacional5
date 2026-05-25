import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { confirmRondaPoint, getRondaPoints, getTodaySchedules, type MobileRondaPoint, type MobileSchedule } from '../services/mobile-data';
import { captureEvidencePhoto, pickEvidenceFromLibrary, uploadEvidencePhoto, type EvidenceAsset } from '../services/evidence';
import { getCurrentLocation } from '../services/location';

export function RondaScreen() {
  const { profile } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [schedules, setSchedules] = useState<MobileSchedule[]>([]);
  const [points, setPoints] = useState<MobileRondaPoint[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<MobileSchedule | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<MobileRondaPoint | null>(null);
  const [qrToken, setQrToken] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<EvidenceAsset | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const nextSchedules = await getTodaySchedules(profile.id);
      setSchedules(nextSchedules);
      const first = nextSchedules[0] ?? null;
      setSelectedSchedule(first);
      if (first) {
        const nextPoints = await getRondaPoints(first.post.id);
        setPoints(nextPoints);
        setSelectedPoint(nextPoints[0] ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { void load(); }, [load]);

  async function selectSchedule(schedule: MobileSchedule) {
    setSelectedSchedule(schedule);
    setSelectedPoint(null);
    setQrToken('');
    setError(null);
    const nextPoints = await getRondaPoints(schedule.post.id);
    setPoints(nextPoints);
    setSelectedPoint(nextPoints[0] ?? null);
  }

  async function startScan() {
    if (!permission?.granted) {
      const next = await requestPermission();
      if (!next.granted) {
        setError('Permissão de câmera negada.');
        return;
      }
    }
    setScanning(true);
  }

  function onScanned(result: BarcodeScanningResult) {
    setQrToken(result.data);
    setScanning(false);
  }

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
    if (!profile || !selectedSchedule || !selectedPoint) return;
    if (!qrToken.trim()) {
      setError('Leia ou informe o QR Code do ponto de ronda.');
      return;
    }
    if (selectedPoint.require_photo && !photo) {
      setError('Este ponto de ronda exige foto.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const location = await getCurrentLocation().catch(() => null);
      const photoUrl = photo ? await uploadEvidencePhoto({ companyId: profile.company_id, asset: photo, prefix: 'ronda' }) : null;
      const result = await confirmRondaPoint({
        profile,
        schedule: selectedSchedule,
        point: selectedPoint,
        location,
        qrToken,
        notes,
        photoUrl,
      });
      setQrToken('');
      setNotes('');
      setPhoto(null);
      setMessage(result.queued ? 'Ronda salva offline para sincronização.' : `Ponto de ronda confirmado: ${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Ronda QR</Text>
      {loading ? <ActivityIndicator color="#1e40af" /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Text style={styles.label}>Posto</Text>
      {schedules.map((schedule) => (
        <Pressable key={schedule.id} onPress={() => void selectSchedule(schedule)} style={[styles.card, selectedSchedule?.id === schedule.id && styles.selected]}>
          <Text style={styles.postName}>{schedule.post.name}</Text>
          <Text style={styles.address}>{schedule.post.address}</Text>
        </Pressable>
      ))}

      <Text style={styles.label}>Ponto de ronda</Text>
      {points.map((point) => (
        <Pressable key={point.id} onPress={() => setSelectedPoint(point)} style={[styles.card, selectedPoint?.id === point.id && styles.selected]}>
          <Text style={styles.postName}>{point.sequence_order}. {point.name}</Text>
          <Text style={styles.address}>Raio: {point.radius_meters}m</Text>
          {point.require_photo ? <Text style={styles.warning}>Foto obrigatória</Text> : null}
        </Pressable>
      ))}
      {!loading && selectedSchedule && points.length === 0 ? <Text style={styles.empty}>Nenhum ponto de ronda cadastrado para este posto.</Text> : null}

      <Text style={styles.label}>QR Code</Text>
      <TextInput value={qrToken} onChangeText={setQrToken} placeholder="Leia ou cole o token do QR Code" style={styles.input} autoCapitalize="none" />
      <Pressable style={styles.secondaryButton} onPress={startScan}>
        <Text style={styles.secondaryButtonText}>Abrir câmera para ler QR</Text>
      </Pressable>

      {scanning ? (
        <View style={styles.cameraBox}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScanned}
          />
        </View>
      ) : null}

      <View style={styles.photoCard}>
        <Text style={styles.label}>Foto da ronda</Text>
        <Text style={styles.photoText}>{photo ? `Foto selecionada: ${photo.fileName}` : 'Opcional, exceto quando o ponto exige foto.'}</Text>
        <View style={styles.row}>
          <Pressable style={[styles.secondaryButton, styles.flex]} onPress={takePhoto}>
            <Text style={styles.secondaryButtonText}>Câmera</Text>
          </Pressable>
          <Pressable style={[styles.secondaryButton, styles.flex]} onPress={choosePhoto}>
            <Text style={styles.secondaryButtonText}>Galeria</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.label}>Observações</Text>
      <TextInput value={notes} onChangeText={setNotes} placeholder="Opcional" multiline style={styles.textarea} />

      <Pressable disabled={!selectedSchedule || !selectedPoint || submitting} onPress={submit} style={[styles.primaryButton, (!selectedSchedule || !selectedPoint || submitting) && styles.disabled]}>
        {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Confirmar ponto</Text>}
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
  label: { fontWeight: '900', color: '#334155' },
  card: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 16 },
  selected: { borderColor: '#2563eb', borderWidth: 2 },
  postName: { fontSize: 17, fontWeight: '900', color: '#0f172a' },
  address: { color: '#64748b', marginTop: 4 },
  warning: { color: '#92400e', backgroundColor: '#fef3c7', padding: 8, borderRadius: 10, marginTop: 8, fontWeight: '800' },
  input: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#cbd5e1', padding: 14, fontSize: 16 },
  textarea: { minHeight: 92, backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#cbd5e1', padding: 14, textAlignVertical: 'top', fontSize: 16 },
  cameraBox: { overflow: 'hidden', borderRadius: 22, borderWidth: 2, borderColor: '#1e40af', height: 320, backgroundColor: '#0f172a' },
  camera: { flex: 1 },
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
  empty: { color: '#64748b', backgroundColor: '#ffffff', padding: 16, borderRadius: 14 },
  backButton: { alignItems: 'center', padding: 14 },
  backText: { color: '#64748b', fontWeight: '800' },
});
