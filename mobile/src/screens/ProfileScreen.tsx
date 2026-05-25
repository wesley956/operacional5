import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export function ProfileScreen() {
  const { profile, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Perfil</Text>
        <Text style={styles.subtitle}>Dados do usuário logado neste aparelho.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Nome</Text>
        <Text style={styles.value}>{profile?.name ?? 'Sem nome'}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{profile?.email ?? 'Sem email'}</Text>

        <Text style={styles.label}>Função</Text>
        <Text style={styles.value}>{profile?.role ?? '-'}</Text>

        <Text style={styles.label}>Status</Text>
        <Text style={styles.value}>{profile?.active ? 'Ativo' : 'Inativo'}</Text>
      </View>

      <Pressable style={styles.primaryButton} onPress={() => router.push('/history')}>
        <Text style={styles.primaryButtonText}>Ver histórico</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonText}>Voltar</Text>
      </Pressable>

      <Pressable style={styles.dangerButton} onPress={handleSignOut}>
        <Text style={styles.dangerButtonText}>Sair do app</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, gap: 16 },
  header: { gap: 6 },
  title: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  subtitle: { color: '#64748b' },
  card: { backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  label: { color: '#64748b', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  value: { color: '#0f172a', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  primaryButton: { backgroundColor: '#1e40af', borderRadius: 14, padding: 15, alignItems: 'center' },
  primaryButtonText: { color: '#ffffff', fontWeight: '800' },
  secondaryButton: { borderWidth: 1, borderColor: '#1e40af', borderRadius: 14, padding: 15, alignItems: 'center' },
  secondaryButtonText: { color: '#1e40af', fontWeight: '800' },
  dangerButton: { backgroundColor: '#fee2e2', borderRadius: 14, padding: 15, alignItems: 'center' },
  dangerButtonText: { color: '#991b1b', fontWeight: '800' },
});
