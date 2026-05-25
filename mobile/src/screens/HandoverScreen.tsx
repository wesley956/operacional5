import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import {
  createShiftHandover,
  getCompanyEmployees,
  getTodaySchedules,
  type MobileEmployeeOption,
  type MobileSchedule,
} from '../services/mobile-data';

export function HandoverScreen() {
  const { profile } = useAuth();
  const [schedules, setSchedules] = useState<MobileSchedule[]>([]);
  const [employees, setEmployees] = useState<MobileEmployeeOption[]>([]);
  const [scheduleId, setScheduleId] = useState<string>('');
  const [incomingEmployeeId, setIncomingEmployeeId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [pendingText, setPendingText] = useState('');
  const [retentionReason, setRetentionReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedSchedule = useMemo(
    () => schedules.find((item) => item.id === scheduleId) ?? schedules[0],
    [schedules, scheduleId]
  );

  const load = useCallback(async () => {
    if (!profile) return;
    setError(null);
    setLoading(true);
    try {
      const [nextSchedules, nextEmployees] = await Promise.all([
        getTodaySchedules(profile.id),
        getCompanyEmployees(profile),
      ]);
      setSchedules(nextSchedules);
      setEmployees(nextEmployees);
      if (!scheduleId && nextSchedules[0]) setScheduleId(nextSchedules[0].id);
      if (!incomingEmployeeId && nextEmployees[0]) setIncomingEmployeeId(nextEmployees[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [profile, scheduleId, incomingEmployeeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit() {
    if (!profile || !selectedSchedule) {
      setError('Nenhuma escala disponível para passagem de plantão.');
      return;
    }

    if (!incomingEmployeeId) {
      setError('Selecione o colaborador que vai assumir o posto.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const pendingItems = pendingText
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);

      const result = await createShiftHandover({
        profile,
        schedule: selectedSchedule,
        incomingEmployeeId,
        notes,
        pendingItems,
        retentionReason: retentionReason.trim() || null,
      });

      setMessage(result.queued ? 'Passagem salva offline. Será sincronizada depois.' : 'Passagem registrada com sucesso.');
      setNotes('');
      setPendingText('');
      setRetentionReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#1e40af" />
        <Text>Carregando passagem de plantão...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Passagem de plantão</Text>
        <Text style={styles.subtitle}>Registre a troca de operador no posto.</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Text style={styles.label}>Posto / escala</Text>
      {schedules.length === 0 ? (
        <Text style={styles.empty}>Nenhuma escala ativa encontrada para hoje.</Text>
      ) : (
        schedules.map((schedule) => (
          <Pressable
            key={schedule.id}
            style={[styles.option, schedule.id === selectedSchedule?.id && styles.optionSelected]}
            onPress={() => setScheduleId(schedule.id)}
          >
            <Text style={styles.optionTitle}>{schedule.post.name}</Text>
            <Text style={styles.optionSubtitle}>{schedule.post.address}</Text>
          </Pressable>
        ))
      )}

      <Text style={styles.label}>Quem vai assumir?</Text>
      {employees.length === 0 ? (
        <Text style={styles.empty}>Nenhum colaborador ativo encontrado.</Text>
      ) : (
        employees.map((employee) => (
          <Pressable
            key={employee.id}
            style={[styles.option, employee.id === incomingEmployeeId && styles.optionSelected]}
            onPress={() => setIncomingEmployeeId(employee.id)}
          >
            <Text style={styles.optionTitle}>{employee.name}</Text>
            <Text style={styles.optionSubtitle}>{employee.role} · {employee.email ?? 'sem email'}</Text>
          </Pressable>
        ))
      )}

      <Text style={styles.label}>Observações</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Ex: plantão sem alterações, portão lateral em manutenção..."
        multiline
        style={[styles.input, styles.textarea]}
      />

      <Text style={styles.label}>Pendências, uma por linha</Text>
      <TextInput
        value={pendingText}
        onChangeText={setPendingText}
        placeholder={'Ex:\nAguardar prestador às 08h\nVerificar câmera do bloco B'}
        multiline
        style={[styles.input, styles.textarea]}
      />

      <Text style={styles.label}>Motivo de retenção, se houver</Text>
      <TextInput
        value={retentionReason}
        onChangeText={setRetentionReason}
        placeholder="Preencha apenas se o operador precisar ficar retido."
        style={styles.input}
      />

      <Pressable style={[styles.primaryButton, submitting && styles.disabled]} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.primaryButtonText}>{submitting ? 'Salvando...' : 'Registrar passagem'}</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonText}>Voltar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#f8fafc' },
  header: { gap: 6 },
  title: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  subtitle: { color: '#64748b' },
  label: { color: '#0f172a', fontWeight: '800', marginTop: 8 },
  input: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#cbd5e1' },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
  option: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 4 },
  optionSelected: { borderColor: '#1e40af', backgroundColor: '#eff6ff' },
  optionTitle: { color: '#0f172a', fontWeight: '800' },
  optionSubtitle: { color: '#64748b' },
  primaryButton: { backgroundColor: '#1e40af', borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 8 },
  primaryButtonText: { color: '#ffffff', fontWeight: '800' },
  secondaryButton: { borderWidth: 1, borderColor: '#1e40af', borderRadius: 14, padding: 15, alignItems: 'center' },
  secondaryButtonText: { color: '#1e40af', fontWeight: '800' },
  disabled: { opacity: 0.6 },
  error: { color: '#b91c1c', fontWeight: '700', backgroundColor: '#fee2e2', padding: 12, borderRadius: 12 },
  success: { color: '#166534', fontWeight: '700', backgroundColor: '#dcfce7', padding: 12, borderRadius: 12 },
  empty: { color: '#64748b', backgroundColor: '#ffffff', borderRadius: 14, padding: 14 },
});
