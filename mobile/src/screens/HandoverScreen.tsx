import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { createShiftHandover, getTodaySchedules, validateHandoverEmployeeByCode, type MobileEmployeeOption, type MobileSchedule } from '../services/mobile-data';
import { captureAndUploadHandoverPhoto, getHandoverLocation, type HandoverLocationResult, type HandoverPhotoResult } from '../services/handover-identity';

export function HandoverScreen() {
  const { profile } = useAuth();
  const [schedules, setSchedules] = useState<MobileSchedule[]>([]);
  const [scheduleId, setScheduleId] = useState('');
  const [incomingEmployeeId, setIncomingEmployeeId] = useState('');
  const [incomingCode, setIncomingCode] = useState('');
  const [incomingPin, setIncomingPin] = useState('');
  const [validatedEmployee, setValidatedEmployee] = useState<MobileEmployeeOption | null>(null);
  const [photo, setPhoto] = useState<HandoverPhotoResult | null>(null);
  const [location, setLocation] = useState<HandoverLocationResult | null>(null);
  const [notes, setNotes] = useState('');
  const [pendingText, setPendingText] = useState('');
  const [retentionReason, setRetentionReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedSchedule = useMemo(() => schedules.find((item) => item.id === scheduleId) ?? schedules[0], [schedules, scheduleId]);
  const incomingEmployee = validatedEmployee;

  const load = useCallback(async () => {
    if (!profile) return;
    setError(null);
    setLoading(true);
    try {
      const nextSchedules = await getTodaySchedules(profile.id);
      setSchedules(nextSchedules);
      if (!scheduleId && nextSchedules[0]) setScheduleId(nextSchedules[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [profile, scheduleId]);

  useEffect(() => { load(); }, [load]);

  async function validateIncoming() {
    setValidating(true); setError(null); setMessage(null); setPhoto(null);
    try {
      const employee = await validateHandoverEmployeeByCode({ fieldCode: incomingCode, pin: incomingPin });
      setValidatedEmployee(employee); setIncomingEmployeeId(employee.id);
      setMessage(`Funcionário validado: ${employee.name}. Agora tire a foto.`);
    } catch (err) { setValidatedEmployee(null); setError(err instanceof Error ? err.message : String(err)); }
    finally { setValidating(false); }
  }

  async function capturePhoto() {
    if (!profile || !incomingEmployee) { setError('Valide quem vai assumir antes de tirar a foto.'); return; }
    setCapturing(true); setError(null); setMessage(null);
    try {
      const [nextPhoto, nextLocation] = await Promise.all([
        captureAndUploadHandoverPhoto({ companyId: profile.company_id, employeeId: incomingEmployee.id }),
        getHandoverLocation(),
      ]);
      setPhoto(nextPhoto); setLocation(nextLocation); setMessage('Foto e localização registradas.');
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setCapturing(false); }
  }

  async function submit() {
    if (!profile || !selectedSchedule) { setError('Nenhuma escala disponível para passagem.'); return; }
    if (!incomingEmployee) { setError('Valide quem vai assumir o posto.'); return; }
    if (!photo?.publicUrl) { setError('Tire a foto do funcionário que vai assumir.'); return; }
    setSubmitting(true); setError(null); setMessage(null);
    try {
      const pendingItems = pendingText.split('\n').map((item) => item.trim()).filter(Boolean);
      const result = await createShiftHandover({
        profile, schedule: selectedSchedule, incomingEmployeeId: incomingEmployee.id, notes, pendingItems,
        retentionReason: retentionReason.trim() || null,
        incomingPhotoUrl: photo.publicUrl,
        gpsLat: location?.gps_lat ?? null,
        gpsLng: location?.gps_lng ?? null,
        gpsValid: location?.gps_valid ?? false,
      });
      setMessage(result.queued ? 'Passagem salva offline.' : 'Passagem registrada com foto.');
      setNotes(''); setPendingText(''); setRetentionReason(''); setIncomingCode(''); setIncomingPin(''); setValidatedEmployee(null); setPhoto(null); setLocation(null);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setSubmitting(false); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#1e40af" /><Text>Carregando passagem...</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}><Text style={styles.title}>Passagem de plantão</Text><Text style={styles.subtitle}>Identifique quem vai assumir com código, foto e localização.</Text></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}{message ? <Text style={styles.success}>{message}</Text> : null}
      <Text style={styles.label}>Posto / escala</Text>
      {schedules.map((schedule) => <Pressable key={schedule.id} style={[styles.option, schedule.id === selectedSchedule?.id && styles.optionSelected]} onPress={() => setScheduleId(schedule.id)}><Text style={styles.optionTitle}>{schedule.post.name}</Text><Text style={styles.optionSubtitle}>{schedule.post.address}</Text></Pressable>)}
      {schedules.length === 0 ? <Text style={styles.empty}>Nenhuma escala ativa encontrada para hoje.</Text> : null}
      <View style={styles.identityCard}>
        <Text style={styles.cardTitle}>Quem vai assumir?</Text><Text style={styles.help}>Digite a matrícula/código do próximo operador. PIN é opcional por enquanto.</Text>
        <TextInput value={incomingCode} onChangeText={(value) => { setIncomingCode(value.toUpperCase()); setValidatedEmployee(null); }} placeholder="Matrícula/código" autoCapitalize="characters" style={styles.input} />
        <TextInput value={incomingPin} onChangeText={setIncomingPin} placeholder="PIN, se configurado" secureTextEntry keyboardType="number-pad" style={styles.input} />
        <Pressable style={[styles.primaryButton, validating && styles.disabled]} onPress={validateIncoming} disabled={validating}><Text style={styles.primaryButtonText}>{validating ? 'Validando...' : 'Validar funcionário'}</Text></Pressable>
        {incomingEmployee ? <View style={styles.validatedBox}><Text style={styles.validatedTitle}>Assumindo: {incomingEmployee.name}</Text><Text style={styles.validatedSub}>{incomingEmployee.role} · {incomingEmployee.email ?? 'sem email'}</Text></View> : null}
      </View>
      <Text style={styles.help}>A seleção manual foi removida. Quem vai assumir precisa informar código/matrícula e confirmar com foto.</Text>

      <Text style={styles.label}>Foto de confirmação</Text><Pressable style={[styles.photoButton, capturing && styles.disabled]} onPress={capturePhoto} disabled={capturing}><Text style={styles.photoButtonText}>{capturing ? 'Abrindo câmera...' : 'Tirar foto de quem vai assumir'}</Text></Pressable>
      {photo?.localUri ? <View style={styles.photoPreview}><Image source={{ uri: photo.localUri }} style={styles.photo} /><Text style={styles.help}>GPS: {location?.gps_valid ? 'válido' : 'não confirmado'}</Text></View> : null}
      <Text style={styles.label}>Observações</Text><TextInput value={notes} onChangeText={setNotes} placeholder="Observações da passagem" multiline style={[styles.input, styles.textarea]} />
      <Text style={styles.label}>Pendências, uma por linha</Text><TextInput value={pendingText} onChangeText={setPendingText} placeholder={'Ex:\nAguardar prestador\nVerificar câmera'} multiline style={[styles.input, styles.textarea]} />
      <Text style={styles.label}>Motivo de retenção, se houver</Text><TextInput value={retentionReason} onChangeText={setRetentionReason} placeholder="Preencha apenas se houver retenção." style={styles.input} />
      <Pressable style={[styles.primaryButton, submitting && styles.disabled]} onPress={submit} disabled={submitting}><Text style={styles.primaryButtonText}>{submitting ? 'Salvando...' : 'Confirmar passagem com foto'}</Text></Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => router.back()}><Text style={styles.secondaryButtonText}>Voltar</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' }, content: { padding: 20, gap: 14 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#f8fafc' },
  header: { gap: 6 }, title: { fontSize: 26, fontWeight: '800', color: '#0f172a' }, subtitle: { color: '#64748b' }, label: { color: '#0f172a', fontWeight: '800', marginTop: 8 },
  input: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#cbd5e1' }, textarea: { minHeight: 96, textAlignVertical: 'top' }, identityCard: { backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 12, borderWidth: 1, borderColor: '#bfdbfe' },
  cardTitle: { color: '#0f172a', fontWeight: '900', fontSize: 18 }, help: { color: '#64748b', lineHeight: 20 }, option: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 4 }, optionSelected: { borderColor: '#1e40af', backgroundColor: '#eff6ff' }, optionTitle: { color: '#0f172a', fontWeight: '800' }, optionSubtitle: { color: '#64748b' },
  validatedBox: { backgroundColor: '#dcfce7', borderRadius: 14, padding: 12, gap: 3 }, validatedTitle: { color: '#166534', fontWeight: '900' }, validatedSub: { color: '#166534' }, photoButton: { backgroundColor: '#0f172a', borderRadius: 14, padding: 15, alignItems: 'center' }, photoButtonText: { color: '#ffffff', fontWeight: '800' }, photoPreview: { backgroundColor: '#ffffff', borderRadius: 18, padding: 12, gap: 8, borderWidth: 1, borderColor: '#e2e8f0' }, photo: { width: '100%', height: 260, borderRadius: 14, backgroundColor: '#e2e8f0' },
  primaryButton: { backgroundColor: '#1e40af', borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 8 }, primaryButtonText: { color: '#ffffff', fontWeight: '800' }, secondaryButton: { borderWidth: 1, borderColor: '#1e40af', borderRadius: 14, padding: 15, alignItems: 'center' }, secondaryButtonText: { color: '#1e40af', fontWeight: '800' }, disabled: { opacity: 0.6 }, error: { color: '#b91c1c', fontWeight: '700', backgroundColor: '#fee2e2', padding: 12, borderRadius: 12 }, success: { color: '#166534', fontWeight: '700', backgroundColor: '#dcfce7', padding: 12, borderRadius: 12 }, empty: { color: '#64748b', backgroundColor: '#ffffff', borderRadius: 14, padding: 14 },
});
