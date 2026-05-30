// ============================================================
// OPERACIONAL5 — Mobile App (React Native + Expo)
// ============================================================
// Este arquivo contém a estrutura de referência para o app mobile.
// Em produção, cada screen e service deve ser um arquivo separado.
// Para rodar: cd mobile && npx expo start
// ============================================================

// --- DEPENDÊNCIAS NECESSÁRIAS ---
// npx expo install expo-router expo-location expo-camera expo-barcode-scanner
// npx expo install expo-sqlite expo-secure-store expo-notifications
// npx expo install @supabase/supabase-js react-native-maps date-fns

/*
ARQUITETURA MOBILE:

mobile/
├── app/
│   ├── _layout.tsx           (Expo Router layout)
│   ├── index.tsx             (Redirect por role)
│   ├── login.tsx             (Login)
│   ├── operator/
│   │   ├── index.tsx         (Home do operador)
│   │   ├── checkin.tsx       (Assumir posto com GPS/QR)
│   │   ├── occurrence.tsx    (Registrar ocorrência)
│   │   ├── sos.tsx           (SOS ativo)
│   │   └── qr-scan.tsx       (Scanner QR)
│   ├── leader/
│   │   └── index.tsx         (Home do líder)
│   └── supervisor/
│       └── index.tsx         (Home do supervisor)
├── services/
│   ├── supabase.ts           (Client Supabase)
│   ├── location.ts           (GPS + geofence)
│   ├── camera.ts             (Câmera + fotos)
│   ├── offline-queue.ts      (SQLite offline queue)
│   ├── sync.ts               (Sync engine)
│   └── notifications.ts      (Push + local)
├── components/
│   ├── SOSButton.tsx
│   ├── OfflineBanner.tsx
│   ├── GPSStatus.tsx
│   └── PhotoCapture.tsx
└── shared/
    └── types.ts              (Tipos compartilhados)
*/

// ============================================================
// SERVICES — Offline Queue (SQLite)
// ============================================================

/*
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'op5_offline.db';

export interface OfflineQueueItem {
  id: string;
  type: 'presence' | 'occurrence' | 'sos' | 'ronda' | 'handover';
  payload_json: string;
  local_photo_uri?: string;
  idempotency_key: string;
  created_at: string;
  synced_at?: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  error_message?: string;
  retry_count: number;
}

export async function initOfflineDB(): Promise<void> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS offline_queue (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      local_photo_uri TEXT,
      idempotency_key TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      retry_count INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_queue_status ON offline_queue(status);
    CREATE INDEX IF NOT EXISTS idx_queue_type ON offline_queue(type);
  `);
}

export async function enqueueOffline(item: Omit<OfflineQueueItem, 'id' | 'retry_count'>): Promise<string> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  await db.runAsync(
    `INSERT INTO offline_queue (id, type, payload_json, local_photo_uri, idempotency_key, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, item.type, item.payload_json, item.local_photo_uri ?? null, item.idempotency_key, 'pending']
  );
  return id;
}

export async function getPendingItems(): Promise<OfflineQueueItem[]> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  return await db.getAllAsync<OfflineQueueItem>(
    `SELECT * FROM offline_queue WHERE status IN ('pending', 'failed') ORDER BY created_at ASC LIMIT 50`
  );
}

export async function markAsSynced(id: string): Promise<void> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.runAsync(
    `UPDATE offline_queue SET status = 'synced', synced_at = datetime('now') WHERE id = ?`,
    [id]
  );
}

export async function markAsFailed(id: string, error: string): Promise<void> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.runAsync(
    `UPDATE offline_queue SET status = 'failed', error_message = ?, retry_count = retry_count + 1 WHERE id = ?`,
    [error, id]
  );
}

export async function getQueueStats(): Promise<{ pending: number; syncing: number; failed: number }> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  const result = await db.getAllAsync<{ status: string; count: number }>(
    `SELECT status, COUNT(*) as count FROM offline_queue GROUP BY status`
  );
  const stats = { pending: 0, syncing: 0, failed: 0 };
  result.forEach(r => {
    if (r.status === 'pending') stats.pending = r.count;
    if (r.status === 'syncing') stats.syncing = r.count;
    if (r.status === 'failed') stats.failed = r.count;
  });
  return stats;
}
*/

// ============================================================
// SERVICES — Location (GPS + Geofence)
// ============================================================

/*
import * as Location from 'expo-location';

export interface LocationResult {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number | null;
  altitude: number | null;
  isMock: boolean;
  timestamp: number;
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation(): Promise<LocationResult> {
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracy: location.coords.accuracy ?? 999,
    speed: location.coords.speed,
    altitude: location.coords.altitude,
    isMock: location.mocked ?? false,
    timestamp: location.timestamp,
  };
}

export async function startLocationTracking(
  onLocation: (loc: LocationResult) => void
): Promise<Location.Subscription> {
  return await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 10000, // 10s
      distanceInterval: 5, // 5m
    },
    (location) => {
      onLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy ?? 999,
        speed: location.coords.speed,
        altitude: location.coords.altitude,
        isMock: location.mocked ?? false,
        timestamp: location.timestamp,
      });
    }
  );
}

// Haversine distance
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
*/

// ============================================================
// SCREENS — Operator Home
// ============================================================

/*
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SOSButton } from '../components/SOSButton';
import { OfflineBanner } from '../components/OfflineBanner';
import { GPSStatus } from '../components/GPSStatus';

export default function OperatorHome() {
  const router = useRouter();
  const [checkedIn, setCheckedIn] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [shiftEnd, setShiftEnd] = useState('18:00');
  const [remainingMinutes, setRemainingMinutes] = useState(0);

  // Posto e turno atual (viria do backend)
  const currentPost = {
    name: 'Portaria Principal - Plaza',
    address: 'Rua Augusta, 500',
  };

  const handleCheckIn = () => {
    router.push('/operator/checkin');
  };

  const handleOccurrence = () => {
    router.push('/operator/occurrence');
  };

  const handleSOS = () => {
    Alert.alert(
      '⚠️ CONFIRMAR SOS',
      'Isso disparará uma emergência e notificará seu supervisor imediatamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'SOS',
          style: 'destructive',
          onPress: () => {
            setSosActive(true);
            // Disparar SOS: criar ocorrência + alerta + tracking
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <OfflineBanner isOnline={isOnline} pendingSync={pendingSync} />

      <ScrollView style={styles.content}>
        <Text style={styles.greeting}>Olá, João</Text>

        {currentPost && (
          <View style={styles.postCard}>
            <Text style={styles.postName}>{currentPost.name}</Text>
            <Text style={styles.postAddress}>{currentPost.address}</Text>
            <GPSStatus />
          </View>
        )}

        {!checkedIn ? (
          <TouchableOpacity style={styles.checkinButton} onPress={handleCheckIn}>
            <Text style={styles.checkinButtonText}>📍 CONFIRMAR CHEGADA</Text>
            <Text style={styles.checkinSubtext}>Assumir posto com GPS</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.checkedInCard}>
            <Text style={styles.checkedInText}>✅ Presente</Text>
            <Text style={styles.remainingText}>
              Turno termina em {remainingMinutes}min ({shiftEnd})
            </Text>

            <TouchableOpacity style={styles.occurrenceButton} onPress={handleOccurrence}>
              <Text style={styles.occurrenceButtonText}>📋 Registrar Ocorrência</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => {}}>
            <Text style={styles.actionText}>🔄 Passagem de Plantão</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => {}}>
            <Text style={styles.actionText}>🔍 Próxima Ronda</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <SOSButton onPress={handleSOS} active={sosActive} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1, padding: 16 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 16 },
  postCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.1,
    shadowRadius: 4, elevation: 2,
  },
  postName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  postAddress: { fontSize: 13, color: '#666', marginTop: 4 },
  checkinButton: {
    backgroundColor: '#2563eb', borderRadius: 16, padding: 24,
    alignItems: 'center', marginBottom: 16, shadowColor: '#2563eb',
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  checkinButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  checkinSubtext: { color: '#93c5fd', fontSize: 14, marginTop: 4 },
  checkedInCard: {
    backgroundColor: '#f0fdf4', borderColor: '#86efac', borderWidth: 2,
    borderRadius: 12, padding: 16, marginBottom: 16,
  },
  checkedInText: { fontSize: 18, fontWeight: 'bold', color: '#166534' },
  remainingText: { fontSize: 14, color: '#15803d', marginTop: 4 },
  occurrenceButton: {
    backgroundColor: '#fff', borderColor: '#dc2626', borderWidth: 1,
    borderRadius: 8, padding: 12, marginTop: 12, alignItems: 'center',
  },
  occurrenceButtonText: { color: '#dc2626', fontSize: 16, fontWeight: '600' },
  actions: { gap: 8 },
  actionButton: {
    backgroundColor: '#fff', borderRadius: 8, padding: 14,
    borderColor: '#e5e7eb', borderWidth: 1,
  },
  actionText: { fontSize: 15, color: '#374151', fontWeight: '500' },
});
*/

// ============================================================
// COMPONENTS — SOS Button
// ============================================================

/*
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';

interface SOSButtonProps {
  onPress: () => void;
  active: boolean;
}

export function SOSButton({ onPress, active }: SOSButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, active && styles.buttonActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.text}>
        {active ? '🚨 SOS ATIVO' : '🆘 SOS'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#dc2626',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonActive: {
    backgroundColor: '#991b1b',
    transform: [{ scale: 1.1 }],
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
*/

// ============================================================
// SERVICES — Sync Engine
// ============================================================

/*
import { getPendingItems, markAsSynced, markAsFailed } from './offline-queue';
import { supabase } from './supabase';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';

let syncInProgress = false;

export async function startSyncEngine(): Promise<void> {
  // Escutar mudanças de conectividade
  NetInfo.addEventListener(state => {
    if (state.isConnected && !syncInProgress) {
      processSyncQueue();
    }
  });

  // Tentar sincronizar ao iniciar
  const netState = await NetInfo.fetch();
  if (netState.isConnected) {
    processSyncQueue();
  }
}

async function processSyncQueue(): Promise<void> {
  if (syncInProgress) return;
  syncInProgress = true;

  try {
    const items = await getPendingItems();

    for (const item of items) {
      try {
        const payload = JSON.parse(item.payload_json);

        // Upload photo first if exists
        if (item.local_photo_uri) {
          const photoUrl = await uploadPhoto(item.local_photo_uri, payload.company_id, payload.post_id);
          payload.photo_url = photoUrl;
        }

        // Send to Supabase
        switch (item.type) {
          case 'presence':
            await supabase.from('presences').upsert(payload, { onConflict: 'idempotency_key' });
            break;
          case 'occurrence':
            await supabase.from('occurrences').insert(payload);
            break;
          case 'sos':
            // SOS: tentar reenviar repetidamente
            const { data: existing } = await supabase
              .from('occurrences')
              .select('id')
              .eq('idempotency_key', payload.idempotency_key)
              .single();
            if (!existing) {
              await supabase.from('occurrences').insert(payload);
              await supabase.from('alert_log').insert(payload.alert);
            }
            break;
        }

        await markAsSynced(item.id);
      } catch (error) {
        await markAsFailed(item.id, String(error));
        // SOS: sempre tentar novamente
        if (item.type === 'sos') {
          setTimeout(() => processSyncQueue(), 5000);
        }
      }
    }
  } finally {
    syncInProgress = false;
  }
}

async function uploadPhoto(
  localUri: string,
  companyId: string,
  postId: string
): Promise<string> {
  const now = new Date();
  const path = `evidence/${companyId}/${postId}/${now.toISOString().slice(0, 7)}/${Date.now()}.jpg`;

  const { data, error } = await supabase.storage
    .from('evidence')
    .upload(path, {
      uri: localUri,
      type: 'image/jpeg',
      name: `${Date.now()}.jpg`,
    });

  if (error) throw error;

  const { data: urlData } = await supabase.storage
    .from('evidence')
    .createSignedUrl(data.path, 3600); // 1h expiry

  return urlData?.signedUrl ?? '';
}
*/
