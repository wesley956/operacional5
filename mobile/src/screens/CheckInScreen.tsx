import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import {
  confirmPresence,
  getTodaySchedules,
  validateHandoverEmployeeByCode,
  type MobileEmployeeOption,
  type MobileSchedule,
} from '../services/mobile-data';
import { captureEvidencePhoto, uploadEvidencePhoto, type EvidenceAsset } from '../services/evidence';
import { getCurrentLocation, isWithinGeofence, type LocationResult } from '../services/location';

export function CheckInScreen() {
  const { profile } = useAuth();
  const [fieldCode, setFieldCode] = useState('');
  const [pin, setPin] = useState('');
  const [validatedEmployee, setValidatedEmployee] = useState<MobileEmployeeOption | null>(null);
  const [schedules, setSchedules] = useState<MobileSchedule[]>([]);
  const [selected, setSelected] = useState<MobileSchedule | null>(null);
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [photo, setPhoto] = useState<EvidenceAsset | null>(null);
  const [validating, setValidating] = useState(false);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gpsValid = useMemo(() => {
    if (!selected || !location) return false;
    return isWithinGeofence(location.lat, location.lng, selected.post.lat, selected.post.lng, selected.post.radius_meters);
  }, [location, selected]);

  const resetAfterCodeChange = useCallback((value: string) => {
    setFieldCode(value.toUpperCase());
    setValidatedEmployee(null);
    setSchedules([]);
    setSelected(null);
    setLocation(null);
    setPhoto(null);
    setMessage(null);
  }, []);

  async function validateEmployee() {
    if (!profile) return;

    const normalizedCode = fieldCode.trim().toUpperCase();
    if (!normalizedCode) {
      setError('Digite a matrícula/código de quem está assumindo o posto.');
      return;
    }

    setValidating(true);
    setLoadingSchedules(true);
    setError(null);
    setMessage(null);

    try {
      const employee = await validateHandoverEmployeeByCode({
        fieldCode: normalizedCode,
        pin,
      });

      setValidatedEmployee(employee);

      const nextSchedules = await getTodaySchedules(employee.id);
      setSchedules(nextSchedules);
      setSelected(nextSchedules[0] ?? null);

      if (nextSchedules.length === 0) {
        setMessage(`Funcionário validado: ${employee.name}. Nenhuma escala encontrada para hoje.`);
      } else {
        setMessage(`Funcionário validado: ${employee.name}. Agora confirme GPS e foto.`);
      }
    } catch (err) {
      setValidatedEmployee(null);
      setSchedules([]);
      setSelected(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setValidating(false);
      setLoadingSchedules(false);
    }
  }

  async function loadLocation() {
    setError(null);
    try {
      setLocation(await getCurrentLocation());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
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

  async function submit() {
    if (!profile) return;

    if (!validatedEmployee) {
      setError('Valide por matrícula/código quem está assumindo o posto.');
      return;
    }

    if (!selected) {
      setError('Selecione a escala/posto antes de confirmar.');
      return;
    }

    if (!location) {
      setError('Atualize a localização antes de confirmar.');
      return;
    }

    if (!photo) {
      setError('A foto é obrigatória para assumir o posto.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const photoUrl = await uploadEvidencePhoto({
        companyId: profile.company_id,
        asset: photo,
        prefix: 'presence',
      });

      const result = await confirmPresence({
        profile,
        employee: validatedEmployee,
        schedule: selected,
        location,
        gpsValid,
        photoUrl,
      });

      setMessage(result.queued ? 'Assunção de posto salva offline para sincronização.' : `Posto assumido por ${validatedEmployee.name}. Status: ${result.status ?? 'valid'}`);
      setPhoto(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Assumir posto</Text>
      <Text style={styles.subtitle}>
        Informe a matrícula/código do operador, confirme a foto e registre o GPS do posto.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <View style={styles.identityCard}>
        <Text style={styles.label}>Quem está assumindo?</Text>
        <TextInput
          value={fieldCode}
          onChangeText={resetAfterCodeChange}
          placeholder="Matrícula/código do operador"
          autoCapitalize="characters"
          style={styles.input}
        />

        <TextInput
          value={pin}
          onChangeText={setPin}
          placeholder="PIN, se configurado"
          secureTextEntry
          keyboardType="number-pad"
          style={styles.input}
        />

        <Pressable style={[styles.primaryButton, validating && styles.disabled]} onPress={validateEmployee} disabled={validating}>
          {validating ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Validar operador</Text>}
        </Pressable>

        {validatedEmployee ? (
          <View style={styles.validatedBox}>
            <Text style={styles.validatedTitle}>Validado: {validatedEmployee.name}</Text>
            <Text style={styles.validatedSub}>{validatedEmployee.role} · {validatedEmployee.email ?? 'sem email'}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>Posto / escala</Text>
      {loadingSchedules ? <ActivityIndicator color="#1e40af" /> : null}

      {!validatedEmployee ? (
        <Text style={styles.empty}>Valide o operador para carregar as escalas de hoje.</Text>
      ) : null}

      {validatedEmployee && schedules.length === 0 && !loadingSchedules ? (
        <Text style={styles.empty}>Nenhuma escala encontrada para hoje.</Text>
      ) : null}

      {schedules.map((schedule) => (
        <Pressable key={schedule.id} onPress={() => setSelected(schedule)} style={[styles.card, selected?.id === schedule.id && styles.selected]}>
          <Text style={styles.postName}>{schedule.post.name}</Text>
          <Text style={styles.address}>{schedule.post.address}</Text>
          <Text style={styles.radius}>Raio permitido: {schedule.post.radius_meters}m</Text>
          <Text style={styles.warning}>Foto obrigatória para assumir o posto</Text>
        </Pressable>
      ))}

      <Pressable style={styles.secondaryButton} onPress={loadLocation}>
        <Text style={styles.secondaryButtonText}>Atualizar localização</Text>
      </Pressable>

      {location ? (
        <View style={styles.locationBox}>
          <Text style={styles.locationText}>GPS: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}</Text>
          <Text style={styles.locationText}>Precisão: {Math.round(location.accuracy)}m</Text>
          <Text style={styles.locationText}>Geofence: {gpsValid ? 'válido' : 'fora do raio'}</Text>
          <Text style={styles.locationText}>Mock location: {location.isMock ? 'suspeito' : 'não detectado'}</Text>
        </View>
      ) : null}

      <View style={styles.photoCard}>
        <Text style={styles.label}>Foto obrigatória</Text>
        <Text style={styles.photoText}>{photo ? `Foto capturada: ${photo.fileName}` : 'Tire uma foto de quem está assumindo o posto.'}</Text>

        {photo?.uri ? <Image source={{ uri: photo.uri }} style={styles.photoPreview} /> : null}

        <Pressable style={styles.secondaryButton} onPress={takePhoto}>
          <Text style={styles.secondaryButtonText}>Abrir câmera</Text>
        </Pressable>
      </View>

      <Pressable
        disabled={!validatedEmployee || !selected || !location || !photo || submitting}
        style={[styles.primaryButton, (!validatedEmployee || !selected || !location || !photo || submitting) && styles.disabled]}
        onPress={submit}
      >
        {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Confirmar assunção do posto</Text>}
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
  subtitle: { color: '#64748b', lineHeight: 20 },
  identityCard: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#bfdbfe', padding: 16, gap: 10 },
  input: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#cbd5e1' },
  card: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 16 },
  selected: { borderColor: '#2563eb', borderWidth: 2 },
  postName: { fontSize: 17, fontWeight: '900', color: '#0f172a' },
  address: { color: '#64748b', marginTop: 4 },
  radius: { color: '#1e40af', marginTop: 8, fontWeight: '800' },
  sectionTitle: { color: '#0f172a', fontWeight: '900', fontSize: 16, marginTop: 4 },
  warning: { color: '#92400e', backgroundColor: '#fef3c7', padding: 8, borderRadius: 10, marginTop: 8, fontWeight: '800' },
  locationBox: { backgroundColor: '#e0f2fe', padding: 14, borderRadius: 16 },
  locationText: { color: '#075985', fontWeight: '700' },
  photoCard: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, gap: 10 },
  photoPreview: { width: '100%', height: 260, borderRadius: 14, backgroundColor: '#e2e8f0' },
  label: { fontWeight: '900', color: '#334155' },
  photoText: { color: '#475569', fontWeight: '700' },
  primaryButton: { backgroundColor: '#1e40af', borderRadius: 16, padding: 16, alignItems: 'center' },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  secondaryButton: { backgroundColor: '#ffffff', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1' },
  secondaryButtonText: { color: '#0f172a', fontWeight: '900' },
  disabled: { opacity: 0.55 },
  error: { color: '#b91c1c', backgroundColor: '#fee2e2', padding: 12, borderRadius: 12 },
  success: { color: '#166534', backgroundColor: '#dcfce7', padding: 12, borderRadius: 12, fontWeight: '800' },
  empty: { color: '#64748b', backgroundColor: '#ffffff', padding: 16, borderRadius: 14 },
  validatedBox: { backgroundColor: '#dcfce7', borderRadius: 14, padding: 12, gap: 3 },
  validatedTitle: { color: '#166534', fontWeight: '900' },
  validatedSub: { color: '#166534' },
  backButton: { alignItems: 'center', padding: 14 },
  backText: { color: '#64748b', fontWeight: '800' },
});
