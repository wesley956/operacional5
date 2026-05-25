import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { SyncProvider } from '../src/context/SyncContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <SyncProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#1e40af' },
            headerTintColor: '#ffffff',
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: '#f1f5f9' },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="home" options={{ title: 'OPERACIONAL5' }} />
          <Stack.Screen name="check-in" options={{ title: 'Check-in' }} />
          <Stack.Screen name="sos" options={{ title: 'SOS' }} />
          <Stack.Screen name="occurrence" options={{ title: 'Ocorrência' }} />
        </Stack>
      </SyncProvider>
    </AuthProvider>
  );
}
