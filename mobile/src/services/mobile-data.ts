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
  employee?: MobileEmployeeOption | null;
  schedule: MobileSchedule;
  location: LocationResult;
  gpsValid: boolean;
  photoUrl?: string | null;
  validationMethod?: 'gps' | 'qr' | 'nfc' | 'manual';
}): Promise<MobileMutationResult> {
  const employeeId = params.employee?.id ?? params.profile.id;
  const idempotencyKey = `presence:${employeeId}:${params.schedule.id}:${todayKey()}`;
  const createdAt = new Date().toISOString();

  const tablePayload = {
    schedule_id: params.schedule.id,
    employee_id: employeeId,
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

export interface MobileEmployeeOption {
  id: string;
  name: string;
  email: string | null;
  role: string;
  active: boolean;
}

export interface MobileHistoryEvent {
  id: string;
  title: string;
  description: string;
  created_at: string;
  kind: 'presence' | 'occurrence' | 'ronda' | 'handover';
  status: string;
}

export async function getCompanyEmployees(profile: MobileProfile): Promise<MobileEmployeeOption[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,name,email,role,active')
    .eq('company_id', profile.company_id)
    .eq('active', true)
    .in('role', ['operador', 'lider', 'supervisor'])
    .neq('id', profile.id)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as MobileEmployeeOption[];
}

export async function createShiftHandover(params: {
  profile: MobileProfile;
  schedule: MobileSchedule;
  incomingEmployeeId: string;
  notes: string;
  pendingItems: string[];
  retentionReason?: string | null;
  incomingPhotoUrl?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsValid?: boolean | null;
}): Promise<MobileMutationResult> {
  const createdAt = new Date().toISOString();
  const idempotencyKey = `handover:${params.profile.id}:${params.schedule.id}:${Date.now()}`;

  const payload = {
    post_id: params.schedule.post.id,
    outgoing_employee_id: params.profile.id,
    incoming_employee_id: params.incomingEmployeeId,
    status: params.retentionReason ? 'retido' : 'confirmada',
    notes: params.notes || null,
    pending_items: params.pendingItems,
    retention_reason: params.retentionReason || null,
    confirmed_at: createdAt,
    incoming_photo_url: params.incomingPhotoUrl || null,
    gps_lat: params.gpsLat ?? null,
    gps_lng: params.gpsLng ?? null,
    gps_valid: Boolean(params.gpsValid),
    device_info: { source: 'mobile_handover_identity' },
    idempotency_key: idempotencyKey,
  };

  if (!(await isProbablyOnline())) {
    return queueEvent({ type: 'handover', idempotencyKey, payload });
  }

  try {
    const { data, error } = await supabase
      .from('shift_handovers')
      .insert(payload)
      .select('id,status,confirmed_at')
      .single();

    if (error) throw error;
    return data as MobileMutationResult;
  } catch (err) {
    if (shouldQueueAfterError(err)) {
      return queueEvent({ type: 'handover', idempotencyKey, payload });
    }
    throw err;
  }
}

export async function getRecentMobileHistory(profile: MobileProfile): Promise<MobileHistoryEvent[]> {
  const [occurrencesResult, presencesResult, rondaResult, handoverResult] = await Promise.allSettled([
    supabase
      .from('occurrences')
      .select('id,type,severity,status,created_at,description')
      .eq('employee_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('presences')
      .select('id,status,created_at,confirmed_at,validation_method')
      .eq('employee_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('ronda_logs')
      .select('id,status,created_at,confirmed_at,notes')
      .eq('employee_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('shift_handovers')
      .select('id,status,created_at,confirmed_at,notes')
      .or(`outgoing_employee_id.eq.${profile.id},incoming_employee_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const events: MobileHistoryEvent[] = [];

  if (occurrencesResult.status === 'fulfilled' && !occurrencesResult.value.error) {
    for (const item of occurrencesResult.value.data ?? []) {
      events.push({
        id: String(item.id),
        kind: 'occurrence',
        title: item.type === 'sos' ? 'SOS enviado' : `Ocorrência: ${item.type}`,
        description: `${item.severity ?? 'sem severidade'} · ${item.description ?? 'sem descrição'}`,
        status: String(item.status ?? 'aberta'),
        created_at: String(item.created_at),
      });
    }
  }

  if (presencesResult.status === 'fulfilled' && !presencesResult.value.error) {
    for (const item of presencesResult.value.data ?? []) {
      events.push({
        id: String(item.id),
        kind: 'presence',
        title: 'Posto assumido',
        description: `Método: ${item.validation_method ?? 'gps'}`,
        status: String(item.status ?? 'valid'),
        created_at: String(item.confirmed_at ?? item.created_at),
      });
    }
  }

  if (rondaResult.status === 'fulfilled' && !rondaResult.value.error) {
    for (const item of rondaResult.value.data ?? []) {
      events.push({
        id: String(item.id),
        kind: 'ronda',
        title: 'Ponto de ronda confirmado',
        description: String(item.notes ?? 'Sem observações'),
        status: String(item.status ?? 'concluida'),
        created_at: String(item.confirmed_at ?? item.created_at),
      });
    }
  }

  if (handoverResult.status === 'fulfilled' && !handoverResult.value.error) {
    for (const item of handoverResult.value.data ?? []) {
      events.push({
        id: String(item.id),
        kind: 'handover',
        title: 'Passagem de plantão',
        description: String(item.notes ?? 'Sem observações'),
        status: String(item.status ?? 'confirmada'),
        created_at: String(item.confirmed_at ?? item.created_at),
      });
    }
  }

  return events
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 20);
}


async function notifySosReceivers(params: {
  profile: MobileProfile;
  occurrenceId?: string | null;
  postId?: string | null;
  description: string;
}) {
  try {
    await supabase.functions.invoke('send-alert', {
      body: {
        company_id: params.profile.company_id,
        roles: ['supervisor', 'gerente', 'admin'],
        title: '🚨 SOS Operacional5',
        body: `${params.profile.name} acionou SOS${params.postId ? ' em um posto' : ''}.`,
        data: {
          type: 'sos',
          occurrence_id: params.occurrenceId ?? null,
          post_id: params.postId ?? null,
          description: params.description,
        },
      },
    });
  } catch (err) {
    console.warn('Falha ao enviar push SOS', err);
  }
}



export async function validateHandoverEmployeeByCode(params: {
  fieldCode: string;
  pin?: string;
}): Promise<MobileEmployeeOption & { field_code?: string; pin_required?: boolean }> {
  const { data, error } = await supabase.functions.invoke('validate-handover-employee', {
    body: { field_code: params.fieldCode, pin: params.pin ?? '' },
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? 'Não foi possível validar o funcionário.');
  return data.employee as MobileEmployeeOption & { field_code?: string; pin_required?: boolean };
}
