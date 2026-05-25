import { supabase } from './supabase';
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

export async function confirmPresence(params: {
  profile: MobileProfile;
  schedule: MobileSchedule;
  location: LocationResult;
  gpsValid: boolean;
}) {
  const idempotencyKey = `presence:${params.profile.id}:${params.schedule.id}:${new Date().toISOString().slice(0, 10)}`;

  const { data, error } = await supabase
    .from('presences')
    .insert({
      schedule_id: params.schedule.id,
      employee_id: params.profile.id,
      post_id: params.schedule.post.id,
      gps_lat: params.location.lat,
      gps_lng: params.location.lng,
      gps_valid: params.gpsValid,
      accuracy: params.location.accuracy,
      validation_method: 'gps',
      is_mock_location: params.location.isMock,
      status: params.gpsValid && !params.location.isMock ? 'valid' : 'pending_review',
      idempotency_key: idempotencyKey,
      device_info: { source: 'mobile', app: 'operacional5' },
    })
    .select('id,status,confirmed_at')
    .single();

  if (error) throw error;
  return data;
}

export async function createOccurrence(params: {
  profile: MobileProfile;
  schedule: MobileSchedule;
  location: LocationResult | null;
  type: 'furto' | 'acidente' | 'invasao' | 'dano' | 'briga' | 'suspeito' | 'outro' | 'sos';
  severity: 'baixa' | 'media' | 'alta' | 'critica';
  description: string;
}) {
  const idempotencyKey = `occurrence:${params.profile.id}:${Date.now()}`;

  const { data, error } = await supabase
    .from('occurrences')
    .insert({
      company_id: params.profile.company_id,
      post_id: params.schedule.post.id,
      employee_id: params.profile.id,
      type: params.type,
      severity: params.severity,
      description: params.description,
      gps_lat: params.location?.lat ?? null,
      gps_lng: params.location?.lng ?? null,
      idempotency_key: idempotencyKey,
    })
    .select('id,type,severity,status,created_at')
    .single();

  if (error) throw error;
  return data;
}
