import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

export default function IndexRoute() {
  const { loading, session } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(session ? '/home' : '/login');
  }, [loading, session]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#ffffff" />
      <Text style={styles.text}>Carregando OPERACIONAL5...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e40af', gap: 16 },
  text: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
