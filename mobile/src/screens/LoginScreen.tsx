import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.logo}>OPERACIONAL5</Text>
        <Text style={styles.subtitle}>App do operador</Text>

        <Text style={styles.label}>E-mail</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          placeholder="operador@empresa.com"
          style={styles.input}
        />

        <Text style={styles.label}>Senha</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Sua senha"
          secureTextEntry
          style={styles.input}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable disabled={submitting} onPress={handleLogin} style={({ pressed }) => [styles.button, pressed && styles.pressed, submitting && styles.disabled]}>
          {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Entrar</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0f172a' },
  card: { borderRadius: 24, backgroundColor: '#ffffff', padding: 24, gap: 12 },
  logo: { fontSize: 28, fontWeight: '900', color: '#1e40af', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#f8fafc' },
  button: { marginTop: 8, backgroundColor: '#1e40af', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.65 },
  error: { color: '#dc2626', fontWeight: '700', backgroundColor: '#fee2e2', padding: 10, borderRadius: 12 },
});
