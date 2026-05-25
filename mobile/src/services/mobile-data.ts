import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { enqueueOfflineEvent, type OfflineEventType } from './offline-queue';
import type { LocationResult } from './location';
import type { MobileProfile } from '../context/AuthContext';

export interface MobilePost {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radius_meters: number;
  require_photo: boolean;
  require_ronda: boolean;
  qr_code_token: string | null;
}

export interface MobileSchedule {
  id: string;
  company_id: string;
  post_id: string;
  employee_id: string;
  shift_start: string;
  shift_end: string;
  status: string;
  post: MobilePost;
}

export interface MobileRondaPoint {
  id: string;
  post_id: string;
  name: string;
  lat: number;
  lng: number;
  radius_meters: number;
  qr_code_token: string | null;
  nfc_uid: string | null;
  sequence_order: number;
  require_photo: boolean;
  active: boolean;
}

export interface MobileMutationResult {
  id: string;
  status?: string;
  type?: string;
  severity?: string;
  created_at?: string;
  confirmed_at?: string;
  queued?: boolean;
}

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayIso() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function isProbablyOnline() {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

function shouldQueueAfterError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase();
  return message.includes('network') || message.includes('fetch') || message.includes('timeout') || message.includes('abort');
}

export async function getTodaySchedules(profileId: string): Promise<MobileSchedule[]> {
  const { data, error } = await supabase
    .from('schedules')
    .select(`
      id, company_id, post_id, employee_id, shift_start, shift_end, status,
      posts:post_id(id,name,address,lat,lng,radius_meters,require_photo,require_ronda,qr_code_token)
    `)
    .eq('employee_id', profileId)
    .eq('is_active', true)
    .neq('status', 'cancelled')
    .lte('shift_start', endOfTodayIso())
    .gte('shift_end', startOfTodayIso())
    .order('shift_start', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((item) => {
    const post = item.posts as MobilePost;
    return {
      id: String(item.id),
      company_id: String(item.company_id),
      post_id: String(item.post_id),
      employee_id: String(item.employee_id),
      shift_start: String(item.shift_start),
      shift_end: String(item.shift_end),
      status: String(item.status),
      post,
    };
  });
}

export async function getRondaPoints(postId: string): Promise<MobileRondaPoint[]> {
  const { data, error } = await supabase
    .from('ronda_points')
    .select('id,post_id,name,lat,lng,radius_meters,qr_code_token,nfc_uid,sequence_order,require_photo,active')
    .eq('post_id', postId)
    .eq('active', true)
    .order('sequence_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as MobileRondaPoint[];
}

async function queueEvent(params: {
  type: OfflineEventType;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  photoUrl?: string | null;
}): Promise<MobileMutationResult> {
  const row = await enqueueOfflineEvent({
    type: params.type,
    idempotencyKey: params.idempotencyKey,
    payload: params.payload,
    photoUrl: params.photoUrl,
  });

  return {
    id: row.id,
    status: 'queued',
    created_at: row.created_at,
    confirmed_at: row.created_at,
    queued: true,
  };
}

export async function confirmPresence(params: {
  profile: MobileProfile;
  schedule: MobileSchedule;
  location: LocationResult;
  gpsValid: boolean;
  photoUrl?: string | null;
  validationMethod?: 'gps' | 'qr' | 'nfc' | 'manual';
}): Promise<MobileMutationResult> {
  const idempotencyKey = `presence:${params.profile.id}:${params.schedule.id}:${todayKey()}`;
  const createdAt = new Date().toISOString();

  const tablePayload = {
    schedule_id: params.schedule.id,
    employee_id: params.profile.id,
    post_id: params.schedule.post.id,
    gps_lat: params.location.lat,
    gps_lng: params.location.lng,
    gps_valid: params.gpsValid,
    accuracy: params.location.accuracy,
    validation_method: params.validationMethod ?? 'gps',
    photo_url: params.photoUrl ?? null,
    is_mock_location: params.location.isMock,
    status: params.gpsValid && !params.location.isMock ? 'valid' : 'pending_review',
    offline_created_at: createdAt,
    device_info: { source: 'mobile', app: 'operacional5' },
    idempotency_key: idempotencyKey,
  };

  const offlinePayload = {
    ...tablePayload,
    company_id: params.profile.company_id,
  };

  if (!(await isProbablyOnline())) {
    return queueEvent({ type: 'presence', idempotencyKey, payload: offlinePayload, photoUrl: params.photoUrl });
  }

  try {
    const { data, error } = await supabase
      .from('presences')
      .insert(tablePayload)
      .select('id,status,confirmed_at')
      .single();

    if (error) throw error;
    return data as MobileMutationResult;
  } catch (err) {
    if (shouldQueueAfterError(err)) {
      return queueEvent({ type: 'presence', idempotencyKey, payload: offlinePayload, photoUrl: params.photoUrl });
    }
    throw err;
  }
}

export async function createOccurrence(params: {
  profile: MobileProfile;
  schedule: MobileSchedule;
  location: LocationResult | null;
  type: 'furto' | 'acidente' | 'invasao' | 'dano' | 'briga' | 'suspeito' | 'outro' | 'sos';
  severity: 'baixa' | 'media' | 'alta' | 'critica';
  description: string;
  photoUrl?: string | null;
}): Promise<MobileMutationResult> {
  const idempotencyKey = `occurrence:${params.profile.id}:${Date.now()}`;
  const syncType: OfflineEventType = params.type === 'sos' ? 'sos' : 'occurrence';
  const createdAt = new Date().toISOString();

  const payload = {
    company_id: params.profile.company_id,
    post_id: params.schedule.post.id,
    employee_id: params.profile.id,
    type: params.type,
    severity: params.severity,
    description: params.description,
    photo_url: params.photoUrl ?? null,
    gps_lat: params.location?.lat ?? null,
    gps_lng: params.location?.lng ?? null,
    status: 'aberta',
    idempotency_key: idempotencyKey,
  };

  if (!(await isProbablyOnline())) {
    const queued = await queueEvent({ type: syncType, idempotencyKey, payload, photoUrl: params.photoUrl });
    return { ...queued, type: params.type, severity: params.severity, created_at: createdAt };
  }

  try {
    const { data, error } = await supabase
      .from('occurrences')
      .insert(payload)
      .select('id,type,severity,status,created_at')
      .single();

    if (error) throw error;
    return data as MobileMutationResult;
  } catch (err) {
    if (shouldQueueAfterError(err)) {
      const queued = await queueEvent({ type: syncType, idempotencyKey, payload, photoUrl: params.photoUrl });
      return { ...queued, type: params.type, severity: params.severity, created_at: createdAt };
    }
    throw err;
  }
}

export async function confirmRondaPoint(params: {
  profile: MobileProfile;
  schedule: MobileSchedule;
  point: MobileRondaPoint;
  location: LocationResult | null;
  qrToken: string;
  notes?: string;
  photoUrl?: string | null;
}): Promise<MobileMutationResult> {
  const expectedToken = params.point.qr_code_token?.trim();
  const scannedToken = params.qrToken.trim();

  if (expectedToken && scannedToken !== expectedToken) {
    throw new Error('QR Code não corresponde ao ponto de ronda selecionado.');
  }

  const createdAt = new Date().toISOString();
  const idempotencyKey = `ronda:${params.profile.id}:${params.point.id}:${Date.now()}`;

  const tablePayload = {
    post_id: params.schedule.post.id,
    employee_id: params.profile.id,
    ronda_point_id: params.point.id,
    status: 'concluida',
    confirmed_at: createdAt,
    gps_lat: params.location?.lat ?? null,
    gps_lng: params.location?.lng ?? null,
    photo_url: params.photoUrl ?? null,
    notes: params.notes ?? null,
    idempotency_key: idempotencyKey,
  };

  const offlinePayload = {
    ...tablePayload,
    company_id: params.profile.company_id,
  };

  if (!(await isProbablyOnline())) {
    return queueEvent({ type: 'ronda', idempotencyKey, payload: offlinePayload, photoUrl: params.photoUrl });
  }

  try {
    const { data, error } = await supabase
      .from('ronda_logs')
      .insert(tablePayload)
      .select('id,status,confirmed_at')
      .single();

    if (error) throw error;
    return data as MobileMutationResult;
  } catch (err) {
    if (shouldQueueAfterError(err)) {
      return queueEvent({ type: 'ronda', idempotencyKey, payload: offlinePayload, photoUrl: params.photoUrl });
    }
    throw err;
  }
}
