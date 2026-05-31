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


export async function createShiftHandover(params: {
  profile: MobileProfile;
  schedule: MobileSchedule;
  incomingEmployee?: MobileEmployeeOption | null;
  incomingEmployeeId?: string;
  notes: string;
  pendingItems?: string | string[];
  retentionReason?: string | null;
  photoUrl?: string | null;
  incomingPhotoUrl?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAccuracy?: number | null;
  gpsValid?: boolean | null;
  isMockLocation?: boolean | null;
  location?: {
    lat: number;
    lng: number;
    accuracy: number;
    isMock?: boolean;
  } | null;
}): Promise<MobileMutationResult> {
  const incomingEmployeeId = params.incomingEmployeeId ?? params.incomingEmployee?.id;

  if (!incomingEmployeeId) {
    throw new Error('Funcionário que vai assumir o plantão não informado.');
  }

  const idempotencyKey = `handover:${params.profile.id}:${incomingEmployeeId}:${params.schedule.id}:${todayKey()}`;
  const createdAt = new Date().toISOString();
  const pendingItemsText = Array.isArray(params.pendingItems)
    ? params.pendingItems.filter(Boolean).join('\n')
    : params.pendingItems ?? null;
  const retentionReasonText = params.retentionReason?.trim() || null;
  const handoverPhotoUrl = params.incomingPhotoUrl ?? params.photoUrl ?? null;
  const gpsLat = params.gpsLat ?? params.location?.lat ?? null;
  const gpsLng = params.gpsLng ?? params.location?.lng ?? null;
  const gpsAccuracy = params.gpsAccuracy ?? params.location?.accuracy ?? null;
  const isMockLocation = params.isMockLocation ?? params.location?.isMock ?? false;
  const gpsValid = params.gpsValid ?? null;

  const payload = {
    company_id: params.profile.company_id,
    schedule_id: params.schedule.id,
    post_id: params.schedule.post.id,
    outgoing_employee_id: params.profile.id,
    incoming_employee_id: incomingEmployeeId,
    notes: params.notes,
    pending_items: pendingItemsText,
    retention_reason: retentionReasonText,
    status: 'completed',
    incoming_photo_url: handoverPhotoUrl,
    gps_lat: gpsLat,
    gps_lng: gpsLng,
    gps_accuracy: gpsAccuracy,
    gps_valid: gpsValid,
    is_mock_location: isMockLocation,
    idempotency_key: idempotencyKey,
    created_at: createdAt,
  };

  if (!(await isProbablyOnline())) {
    return queueEvent({ type: 'handover', idempotencyKey, payload, photoUrl: handoverPhotoUrl });
  }

  try {
    const { data, error } = await supabase
      .from('shift_handovers')
      .insert(payload)
      .select('id,status,created_at')
      .single();

    if (error) throw error;
    return data as MobileMutationResult;
  } catch (err) {
    if (shouldQueueAfterError(err)) {
      return queueEvent({ type: 'handover', idempotencyKey, payload, photoUrl: handoverPhotoUrl });
    }

    throw err;
  }
}


export interface MobileHistoryEvent {
  id: string;
  kind: 'presence' | 'occurrence' | 'ronda' | 'handover';
  title: string;
  description: string;
  status: string;
  created_at: string;
  post_name?: string | null;
  employee_name?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  gps_valid?: boolean | null;
  accuracy?: number | null;
  validation_method?: string | null;
  photo_url?: string | null;
  is_mock_location?: boolean | null;
}
export async function getRecentMobileHistory(profile: MobileProfile): Promise<MobileHistoryEvent[]> {
  function relationName(value: unknown): string | null {
    if (!value) return null;

    if (Array.isArray(value)) {
      const first = value[0] as { name?: unknown } | undefined;
      return typeof first?.name === 'string' ? first.name : null;
    }

    if (typeof value === 'object' && 'name' in value) {
      const name = (value as { name?: unknown }).name;
      return typeof name === 'string' ? name : null;
    }

    return null;
  }

  function asNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  function asBoolean(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
  }

  function asString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  const [presencesResult, occurrencesResult, rondaResult, handoverResult] = await Promise.allSettled([
    supabase
      .from('presences')
      .select('id,employee_id,post_id,status,confirmed_at,created_at,gps_lat,gps_lng,gps_valid,accuracy,validation_method,photo_url,is_mock_location,posts:post_id(name),profiles:employee_id(name)')
      .order('confirmed_at', { ascending: false })
      .limit(20),

    supabase
      .from('occurrences')
      .select('id,type,severity,status,description,created_at,photo_url,gps_lat,gps_lng,posts:post_id(name)')
      .order('created_at', { ascending: false })
      .limit(10),

    supabase
      .from('ronda_logs')
      .select('id,status,created_at,confirmed_at,gps_lat,gps_lng,photo_url,posts:post_id(name)')
      .order('created_at', { ascending: false })
      .limit(10),

    supabase
      .from('shift_handovers')
      .select('id,status,created_at,notes,incoming_photo_url,gps_lat,gps_lng,posts:post_id(name)')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const events: MobileHistoryEvent[] = [];

  if (presencesResult.status === 'fulfilled' && !presencesResult.value.error) {
    for (const item of presencesResult.value.data ?? []) {
      const row = item as Record<string, unknown>;
      const createdAt = asString(row.confirmed_at) ?? asString(row.created_at) ?? new Date().toISOString();
      const postName = relationName(row.posts);
      const employeeName = relationName(row.profiles);

      events.push({
        id: String(row.id),
        kind: 'presence',
        title: employeeName ? `${employeeName} assumiu posto` : 'Assumiu posto',
        description: postName ? `Posto: ${postName}` : 'Assunção de posto registrada.',
        status: String(row.status ?? 'unknown'),
        created_at: createdAt,
        post_name: postName,
        employee_name: employeeName,
        gps_lat: asNumber(row.gps_lat),
        gps_lng: asNumber(row.gps_lng),
        gps_valid: asBoolean(row.gps_valid),
        accuracy: asNumber(row.accuracy),
        validation_method: asString(row.validation_method),
        photo_url: asString(row.photo_url),
        is_mock_location: asBoolean(row.is_mock_location),
      });
    }
  }

  if (occurrencesResult.status === 'fulfilled' && !occurrencesResult.value.error) {
    for (const item of occurrencesResult.value.data ?? []) {
      const row = item as Record<string, unknown>;
      const type = String(row.type ?? 'ocorrência');
      const severity = String(row.severity ?? '');
      const postName = relationName(row.posts);

      events.push({
        id: String(row.id),
        kind: 'occurrence',
        title: `Ocorrência: ${type}`,
        description: `${severity ? `${severity} · ` : ''}${String(row.description ?? 'Sem descrição')}${postName ? ` · ${postName}` : ''}`,
        status: String(row.status ?? 'unknown'),
        created_at: asString(row.created_at) ?? new Date().toISOString(),
        post_name: postName,
        gps_lat: asNumber(row.gps_lat),
        gps_lng: asNumber(row.gps_lng),
        photo_url: asString(row.photo_url),
      });
    }
  }

  if (rondaResult.status === 'fulfilled' && !rondaResult.value.error) {
    for (const item of rondaResult.value.data ?? []) {
      const row = item as Record<string, unknown>;
      const postName = relationName(row.posts);

      events.push({
        id: String(row.id),
        kind: 'ronda',
        title: 'Ronda registrada',
        description: postName ? `Posto: ${postName}` : 'Ponto de ronda confirmado.',
        status: String(row.status ?? 'unknown'),
        created_at: asString(row.confirmed_at) ?? asString(row.created_at) ?? new Date().toISOString(),
        post_name: postName,
        gps_lat: asNumber(row.gps_lat),
        gps_lng: asNumber(row.gps_lng),
        photo_url: asString(row.photo_url),
      });
    }
  }

  if (handoverResult.status === 'fulfilled' && !handoverResult.value.error) {
    for (const item of handoverResult.value.data ?? []) {
      const row = item as Record<string, unknown>;
      const postName = relationName(row.posts);

      events.push({
        id: String(row.id),
        kind: 'handover',
        title: 'Passagem de plantão',
        description: `${postName ? `Posto: ${postName}` : 'Passagem registrada.'}${row.notes ? ` · ${String(row.notes)}` : ''}`,
        status: String(row.status ?? 'unknown'),
        created_at: asString(row.created_at) ?? new Date().toISOString(),
        post_name: postName,
        gps_lat: asNumber(row.gps_lat),
        gps_lng: asNumber(row.gps_lng),
        photo_url: asString(row.incoming_photo_url),
      });
    }
  }

  return events
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 40);
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
