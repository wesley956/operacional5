import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';

export function QRScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [value, setValue] = useState<string | null>(null);

  function onScanned(result: BarcodeScanningResult) {
    setScanned(true);
    setValue(result.data);
  }

  if (!permission) {
    return <View style={styles.center}><Text>Carregando permissão da câmera...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Leitor de QR Code</Text>
        <Text style={styles.text}>Precisamos da câmera para ler o QR Code do posto ou ponto de ronda.</Text>
        <Pressable style={styles.primaryButton} onPress={() => void requestPermission()}>
          <Text style={styles.primaryButtonText}>Liberar câmera</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>Voltar</Text></Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Leitor de QR Code</Text>
      <View style={styles.cameraBox}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : onScanned}
        />
      </View>
      {value ? <Text style={styles.result}>QR lido: {value}</Text> : <Text style={styles.text}>Aponte a câmera para o QR Code.</Text>}
      <Pressable style={styles.primaryButton} onPress={() => { setScanned(false); setValue(null); }}>
        <Text style={styles.primaryButtonText}>Ler novamente</Text>
      </Pressable>
      <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>Voltar</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14, backgroundColor: '#f1f5f9' },
  title: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  text: { color: '#475569', fontWeight: '700' },
  cameraBox: { overflow: 'hidden', borderRadius: 22, borderWidth: 2, borderColor: '#1e40af', height: 360, backgroundColor: '#0f172a' },
  camera: { flex: 1 },
  result: { color: '#166534', backgroundColor: '#dcfce7', padding: 12, borderRadius: 12, fontWeight: '900' },
  primaryButton: { backgroundColor: '#1e40af', borderRadius: 16, padding: 16, alignItems: 'center' },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  backButton: { alignItems: 'center', padding: 14 },
  backText: { color: '#64748b', fontWeight: '800' },
});
