// ============================================================
// OPERACIONAL5 — Supabase Data Adapter
// ============================================================
// Adapter real inicial para Supabase.
// Usa o client centralizado do frontend com ANON KEY + RLS.
// NUNCA usar service_role no frontend.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase/client';
import type {
  IDataProvider,
  PostFilters,
  EmployeeFilters,
  PresenceFilters,
  OccurrenceFilters,
  FTFilters,
  RondaFilters,
  HandoverFilters,
  AuditFilters,
  NotificationFilters,
  ScheduleFilters,
  ConfirmPresenceInput,
  PresenceResult,
  CreateOccurrenceInput,
  TriggerSOSInput,
  OpenFTInput,
  ReportData,
  NotificationData,
  RondaPointData,
  RondaLogData,
  ConfirmRondaInput,
  HandoverData,
  CreateHandoverInput,
  AuditEntryInput,
  AuditEntryData,
  ScheduleConflictData,
} from '../data-provider';
import { checkGeofence, haversineDistance } from '../../geo';
import type {
  DashboardSummary,
  FTRequest,
  Occurrence,
  OperationalPostStatus,
  Post,
  Presence,
  Profile,
  Role,
  Schedule,
} from '../../types';

type DbRow = Record<string, unknown>;


function assertNoError(error: unknown, context: string): void {
  if (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${context}: ${message}`);
  }
}

function asPost(row: DbRow): Post {
  return row as unknown as Post;
}

function asPresence(row: DbRow): Presence {
  return row as unknown as Presence;
}

function asOccurrence(row: DbRow): Occurrence {
  return row as unknown as Occurrence;
}

function asFT(row: DbRow): FTRequest {
  return row as unknown as FTRequest;
}

function asSchedule(row: DbRow): Schedule {
  return row as unknown as Schedule;
}

function asRondaPoint(row: DbRow): RondaPointData {
  return row as unknown as RondaPointData;
}

function asRondaLog(row: DbRow): RondaLogData {
  return row as unknown as RondaLogData;
}

function asHandover(row: DbRow): HandoverData {
  return {
    ...(row as unknown as HandoverData),
    pending_items: Array.isArray(row.pending_items) ? row.pending_items as string[] : [],
  };
}

function asAuditEntry(row: DbRow): AuditEntryData {
  const profile = row.profiles as { name?: string } | undefined;

  return {
    id: String(row.id),
    company_id: String(row.company_id),
    actor_id: String(row.actor_id ?? ''),
    actor_name: profile?.name ?? 'Sistema',
    action: String(row.action),
    entity: String(row.entity),
    entity_id: String(row.entity_id),
    metadata: (row.metadata as Record<string, unknown> | undefined) ?? undefined,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

function normalizeProfile(row: DbRow): Profile {
  return {
    id: String(row.id),
    user_id: String(row.user_id ?? row.id),
    company_id: String(row.company_id),
    role: row.role as Role,
    name: String(row.name),
    email: String(row.email ?? ''),
    phone: row.phone ? String(row.phone) : undefined,
    avatar_url: row.avatar_url ? String(row.avatar_url) : undefined,
    fcm_token: row.fcm_token ? String(row.fcm_token) : undefined,
    ft_available: Boolean(row.ft_available),
    regime_trabalho: (row.regime_trabalho as Profile['regime_trabalho']) ?? '12x36',
    data_referencia_ciclo: String(row.data_referencia_ciclo ?? '2024-01-01'),
    active: row.active !== false,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function notificationSeverity(type: string): NotificationData['severity'] {
  if (type === 'sos') return 'critical';
  if (type === 'ocorrencia_critica' || type === 'mock_location') return 'danger';
  if (type === 'ausencia' || type === 'atraso' || type === 'ronda_atrasada' || type === 'retencao') return 'warning';
  return 'info';
}

function payloadMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

async function getCurrentProfileRow(supabase: SupabaseClient): Promise<DbRow> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  assertNoError(userError, 'Erro ao buscar usuário autenticado');

  const userId = userData.user?.id;

  if (!userId) {
    throw new Error('Usuário não autenticado.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .single();

  assertNoError(error, 'Erro ao buscar perfil autenticado');

  if (!data) {
    throw new Error('Perfil autenticado não encontrado.');
  }

  return data as DbRow;
}

async function getCurrentProfile(supabase: SupabaseClient): Promise<Profile> {
  return normalizeProfile(await getCurrentProfileRow(supabase));
}

async function countTable(
  supabase: SupabaseClient,
  table: string,
  apply?: (query: any) => any,
): Promise<number> {
  let query: any = supabase.from(table).select('id', { count: 'exact', head: true });
  if (apply) query = apply(query);
  const { count, error } = await query;
  assertNoError(error, `Erro ao contar ${table}`);
  return count ?? 0;
}

/**
 * Cria o adapter Supabase.
 * @param url - mantido por compatibilidade com a factory
 * @param _key - mantido por compatibilidade com a factory
 */
export function createSupabaseAdapter(url: string, _key: string): IDataProvider {
  const supabase = getSupabaseClient();
  console.log(`[OP5] Supabase adapter initialized for: ${url.substring(0, 30)}...`);

  return {
    posts: {
      async list(filters?: PostFilters): Promise<Post[]> {
        let query = supabase.from('posts').select('*').order('name', { ascending: true });

        if (filters?.company_id) query = query.eq('company_id', filters.company_id);
        if (filters?.client_id) query = query.eq('client_id', filters.client_id);

        if (filters?.active !== undefined) {
          query = query.eq('active', filters.active);
        } else {
          query = query.eq('active', true);
        }

        const { data, error } = await query;
        assertNoError(error, 'Erro ao listar postos');
        return ((data ?? []) as DbRow[]).map(asPost);
      },

      async getById(id: string): Promise<Post | null> {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        assertNoError(error, 'Erro ao buscar posto');
        return data ? asPost(data as DbRow) : null;
      },

      async create(data: Omit<Post, 'id' | 'created_at' | 'updated_at' | 'qr_code_token'>): Promise<Post> {
        const { data: row, error } = await supabase
          .from('posts')
          .insert(data)
          .select('*')
          .single();

        assertNoError(error, 'Erro ao criar posto');
        return asPost(row as DbRow);
      },

      async update(id: string, data: Partial<Post>): Promise<Post> {
        const { data: row, error } = await supabase
          .from('posts')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select('*')
          .single();

        assertNoError(error, 'Erro ao atualizar posto');
        return asPost(row as DbRow);
      },

      async getOperationalStatuses(): Promise<OperationalPostStatus[]> {
        const posts = await this.list({ active: true });

        const { data: presences, error: presencesError } = await supabase
          .from('presences')
          .select('id, post_id, status, confirmed_at')
          .in('status', ['valid', 'pending_review']);

        assertNoError(presencesError, 'Erro ao buscar presenças para status operacional');

        const { data: sosRows, error: sosError } = await supabase
          .from('occurrences')
          .select('id, post_id')
          .eq('type', 'sos')
          .in('status', ['aberta', 'em_tratamento']);

        assertNoError(sosError, 'Erro ao buscar SOS ativos');

        return posts.map((post) => {
          const confirmedCount = ((presences ?? []) as DbRow[]).filter(p => p.post_id === post.id).length;
          const sosCount = ((sosRows ?? []) as DbRow[]).filter(o => o.post_id === post.id).length;

          const status =
            sosCount > 0 ? 'sos_ativo' :
            confirmedCount >= post.min_staff ? 'coberto' :
            confirmedCount > 0 ? 'parcialmente_coberto' :
            'descoberto';

          return {
            post_id: post.id,
            post_name: post.name,
            client_name: '',
            status,
            confirmed_count: confirmedCount,
            min_staff: post.min_staff,
            missing_count: Math.max(0, post.min_staff - confirmedCount),
            active_sos: sosCount,
            active_sos_count: sosCount,
            employees_present: [],
            employees_missing: [],
            last_presence_at: ((presences ?? []) as DbRow[])
              .filter(p => p.post_id === post.id)
              .map(p => String(p.confirmed_at))
              .sort()
              .at(-1),
          } as unknown as OperationalPostStatus;
        });
      },

      async getOperationalStatus(postId: string): Promise<OperationalPostStatus | null> {
        const statuses = await this.getOperationalStatuses();
        return statuses.find(status => status.post_id === postId) ?? null;
      },
    },

    employees: {
      async list(filters?: EmployeeFilters): Promise<Profile[]> {
        let query = supabase.from('profiles').select('*').order('name', { ascending: true });

        if (filters?.company_id) query = query.eq('company_id', filters.company_id);
        if (filters?.role) query = query.eq('role', filters.role);
        if (filters?.active !== undefined) query = query.eq('active', filters.active);
        if (filters?.ft_available !== undefined) query = query.eq('ft_available', filters.ft_available);

        const { data, error } = await query;
        assertNoError(error, 'Erro ao listar funcionários');
        return ((data ?? []) as DbRow[]).map(normalizeProfile);
      },

      async getById(id: string): Promise<Profile | null> {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        assertNoError(error, 'Erro ao buscar funcionário');
        return data ? normalizeProfile(data as DbRow) : null;
      },

      async create(data: Omit<Profile, 'id' | 'created_at' | 'updated_at'>): Promise<Profile> {
        const { data: row, error } = await supabase
          .from('profiles')
          .insert(data)
          .select('*')
          .single();

        assertNoError(error, 'Erro ao criar funcionário');
        return normalizeProfile(row as DbRow);
      },

      async update(id: string, data: Partial<Profile>): Promise<Profile> {
        const { data: row, error } = await supabase
          .from('profiles')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select('*')
          .single();

        assertNoError(error, 'Erro ao atualizar funcionário');
        return normalizeProfile(row as DbRow);
      },

      async getAvailableForFT(): Promise<Profile[]> {
        return this.list({ active: true, ft_available: true });
      },
    },

    presence: {
      async confirm(input: ConfirmPresenceInput): Promise<PresenceResult> {
        const inputMeta = input as ConfirmPresenceInput & {
          speed?: number;
          altitude?: number;
          offline_created_at?: string;
        };

        const { data: existing, error: existingError } = await supabase
          .from('presences')
          .select('*')
          .eq('idempotency_key', input.idempotency_key)
          .maybeSingle();

        assertNoError(existingError, 'Erro ao verificar idempotência da presença');

        if (existing) {
          return {
            success: true,
            presence: asPresence(existing as DbRow),
            message: 'Presença já registrada',
            status: 'approved',
          };
        }

        const { data: postRow, error: postError } = await supabase
          .from('posts')
          .select('*')
          .eq('id', input.post_id)
          .single();

        assertNoError(postError, 'Erro ao buscar posto para presença');

        if (!postRow) {
          return {
            success: false,
            presence: null,
            message: 'Posto não encontrado',
            status: 'rejected',
          };
        }

        const post = asPost(postRow as DbRow);
        let distance = 0;
        let gpsValid = false;
        let status: PresenceResult['status'] = 'approved';
        let mockReasons: string[] = [];

        if (input.method === 'gps') {
          if (typeof input.lat !== 'number' || typeof input.lng !== 'number') {
            return {
              success: false,
              presence: null,
              message: 'Latitude e longitude são obrigatórias para presença via GPS.',
              status: 'rejected',
            };
          }

          distance = haversineDistance(input.lat, input.lng, post.lat, post.lng);
          const check = checkGeofence(
            input.lat,
            input.lng,
            post.lat,
            post.lng,
            post.radius_meters,
            input.accuracy,
            inputMeta.speed,
            inputMeta.altitude,
          );

          gpsValid = check.within_fence;
          mockReasons = check.mock_reasons;

          if (check.mock_detected || input.is_mock_location) {
            return {
              success: false,
              presence: null,
              message: `GPS falso detectado: ${mockReasons.join(', ') || 'sinal suspeito'}`,
              status: 'rejected',
              distance_meters: distance,
            };
          }

          if (!check.within_fence) {
            return {
              success: false,
              presence: null,
              message: `Fora do raio do posto. Distância: ${Math.round(distance)}m (raio: ${post.radius_meters}m)`,
              status: 'rejected',
              distance_meters: distance,
            };
          }

          if (!check.accuracy_ok) {
            status = 'pending_review';
          }
        }

        if (input.method === 'qr') {
          if (!input.qr_code_token || input.qr_code_token !== post.qr_code_token) {
            return {
              success: false,
              presence: null,
              message: 'QR Code inválido para este posto',
              status: 'rejected',
            };
          }

          gpsValid = true;
        }

        if (input.method === 'nfc') {
          if (!input.nfc_uid || input.nfc_uid !== post.nfc_uid) {
            return {
              success: false,
              presence: null,
              message: 'NFC inválido para este posto',
              status: 'rejected',
            };
          }

          gpsValid = true;
        }

        const dbStatus =
          status === 'approved'
            ? 'valid'
            : status === 'pending_review'
              ? 'pending_review'
              : 'rejected';

        const insertPayload = {
          schedule_id: input.schedule_id,
          employee_id: input.employee_id,
          post_id: input.post_id,
          gps_lat: input.lat,
          gps_lng: input.lng,
          gps_valid: gpsValid,
          accuracy: input.accuracy,
          validation_method: input.method,
          photo_url: input.photo_url,
          is_mock_location: input.is_mock_location ?? false,
          mock_reasons: mockReasons,
          status: dbStatus,
          idempotency_key: input.idempotency_key,
          device_info: input.device_info,
          offline_created_at: inputMeta.offline_created_at,
          synced_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from('presences')
          .insert(insertPayload)
          .select('*')
          .single();

        assertNoError(error, 'Erro ao confirmar presença');

        const presence = asPresence(data as DbRow);

        return {
          success: true,
          presence,
          message: status === 'approved' ? 'Presença confirmada!' : 'Presença registrada para revisão',
          status,
          distance_meters: distance,
        };
      },

      async list(filters?: PresenceFilters): Promise<Presence[]> {
        let query = supabase.from('presences').select('*').order('confirmed_at', { ascending: false });

        if (filters?.post_id) query = query.eq('post_id', filters.post_id);
        if (filters?.employee_id) query = query.eq('employee_id', filters.employee_id);
        if (filters?.method) query = query.eq('validation_method', filters.method);
        if (filters?.status) query = query.eq('status', filters.status);
        if (filters?.date_from) query = query.gte('confirmed_at', filters.date_from);
        if (filters?.date_to) query = query.lte('confirmed_at', filters.date_to);

        const { data, error } = await query;
        assertNoError(error, 'Erro ao listar presenças');
        return ((data ?? []) as DbRow[]).map(asPresence);
      },

      async getById(id: string): Promise<Presence | null> {
        const { data, error } = await supabase.from('presences').select('*').eq('id', id).maybeSingle();
        assertNoError(error, 'Erro ao buscar presença');
        return data ? asPresence(data as DbRow) : null;
      },
    },

    occurrences: {
      async create(input: CreateOccurrenceInput): Promise<Occurrence> {
        const { data: existing, error: existingError } = await supabase
          .from('occurrences')
          .select('*')
          .eq('idempotency_key', input.idempotency_key)
          .maybeSingle();

        assertNoError(existingError, 'Erro ao verificar idempotência da ocorrência');

        if (existing) {
          return asOccurrence(existing as DbRow);
        }

        const profile = await getCurrentProfile(supabase);

        const insertPayload = {
          company_id: profile.company_id,
          post_id: input.post_id,
          employee_id: input.employee_id,
          type: input.type,
          severity: input.severity,
          description: input.description,
          photo_url: input.photo_url,
          gps_lat: input.lat,
          gps_lng: input.lng,
          status: 'aberta',
          idempotency_key: input.idempotency_key,
        };

        const { data, error } = await supabase
          .from('occurrences')
          .insert(insertPayload)
          .select('*')
          .single();

        assertNoError(error, 'Erro ao criar ocorrência');

        const occurrence = asOccurrence(data as DbRow);

        if (occurrence.severity === 'critica') {
          const { data: supervisors } = await supabase
            .from('supervisor_posts')
            .select('supervisor_id')
            .eq('post_id', input.post_id);

          for (const supervisor of ((supervisors ?? []) as DbRow[])) {
            if (!supervisor.supervisor_id) continue;

            await supabase.from('alert_log').insert({
              company_id: profile.company_id,
              type: 'ocorrencia_critica',
              target_user_id: supervisor.supervisor_id,
              post_id: input.post_id,
              occurrence_id: occurrence.id,
              payload: {
                message: `Ocorrência crítica registrada: ${input.description ?? input.type}`,
              },
              channel: 'system',
              status: 'sent',
            });
          }
        }

        return occurrence;
      },

      async list(filters?: OccurrenceFilters): Promise<Occurrence[]> {
        let query = supabase.from('occurrences').select('*').order('created_at', { ascending: false });

        if (filters?.post_id) query = query.eq('post_id', filters.post_id);
        if (filters?.employee_id) query = query.eq('employee_id', filters.employee_id);
        if (filters?.type) query = query.eq('type', filters.type);
        if (filters?.severity) query = query.eq('severity', filters.severity);
        if (filters?.status) query = query.eq('status', filters.status);

        const { data, error } = await query;
        assertNoError(error, 'Erro ao listar ocorrências');
        return ((data ?? []) as DbRow[]).map(asOccurrence);
      },

      async getById(id: string): Promise<Occurrence | null> {
        const { data, error } = await supabase.from('occurrences').select('*').eq('id', id).maybeSingle();
        assertNoError(error, 'Erro ao buscar ocorrência');
        return data ? asOccurrence(data as DbRow) : null;
      },

      async acknowledge(id: string, role: Role): Promise<Occurrence> {
        const profile = await getCurrentProfile(supabase);

        const updatePayload: Record<string, unknown> = {
          status: 'em_tratamento',
          updated_at: new Date().toISOString(),
        };

        const effectiveRole = profile.role ?? role;

        if (effectiveRole === 'supervisor') {
          updatePayload.ack_supervisor = profile.id;
        }

        if (['gerente', 'diretor', 'admin'].includes(effectiveRole)) {
          updatePayload.ack_gerente = profile.id;
        }

        const { data, error } = await supabase
          .from('occurrences')
          .update(updatePayload)
          .eq('id', id)
          .select('*')
          .single();

        assertNoError(error, 'Erro ao reconhecer ocorrência');
        return asOccurrence(data as DbRow);
      },

      async resolve(id: string, resolvedBy: string): Promise<Occurrence> {
        const profile = await getCurrentProfile(supabase);

        const { data, error } = await supabase
          .from('occurrences')
          .update({
            status: 'resolvida',
            resolved_by: resolvedBy || profile.id,
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('*')
          .single();

        assertNoError(error, 'Erro ao resolver ocorrência');
        return asOccurrence(data as DbRow);
      },
    },

    sos: {
      async trigger(input: TriggerSOSInput): Promise<Occurrence> {
        const { data: existing, error: existingError } = await supabase
          .from('occurrences')
          .select('*')
          .eq('idempotency_key', input.idempotency_key)
          .maybeSingle();

        assertNoError(existingError, 'Erro ao verificar idempotência do SOS');

        if (existing) {
          return asOccurrence(existing as DbRow);
        }

        const profile = await getCurrentProfile(supabase);

        const { data, error } = await supabase
          .from('occurrences')
          .insert({
            company_id: profile.company_id,
            post_id: input.post_id,
            employee_id: input.employee_id,
            type: 'sos',
            severity: 'critica',
            description: `SOS disparado por ${profile.name}`,
            gps_lat: input.lat,
            gps_lng: input.lng,
            status: 'aberta',
            idempotency_key: input.idempotency_key,
          })
          .select('*')
          .single();

        assertNoError(error, 'Erro ao disparar SOS');

        const occurrence = asOccurrence(data as DbRow);

        const { data: supervisors } = await supabase
          .from('supervisor_posts')
          .select('supervisor_id')
          .eq('post_id', input.post_id);

        for (const supervisor of ((supervisors ?? []) as DbRow[])) {
          if (!supervisor.supervisor_id) continue;

          await supabase.from('alert_log').insert({
            company_id: profile.company_id,
            type: 'sos',
            target_user_id: supervisor.supervisor_id,
            post_id: input.post_id,
            occurrence_id: occurrence.id,
            payload: {
              message: `SOS disparado por ${profile.name}`,
            },
            channel: 'system',
            status: 'sent',
          });
        }

        return occurrence;
      },

      async close(occurrenceId: string, closedBy: string, _resolution: string): Promise<Occurrence> {
        const profile = await getCurrentProfile(supabase);

        const { data, error } = await supabase
          .from('occurrences')
          .update({
            status: 'resolvida',
            resolved_by: closedBy || profile.id,
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', occurrenceId)
          .eq('type', 'sos')
          .select('*')
          .single();

        assertNoError(error, 'Erro ao encerrar SOS');
        return asOccurrence(data as DbRow);
      },

      async getActive(): Promise<Occurrence[]> {
        const { data, error } = await supabase
          .from('occurrences')
          .select('*')
          .eq('type', 'sos')
          .in('status', ['aberta', 'em_tratamento'])
          .order('created_at', { ascending: false });

        assertNoError(error, 'Erro ao listar SOS ativos');
        return ((data ?? []) as DbRow[]).map(asOccurrence);
      },
    },

    ft: {
      async list(filters?: FTFilters): Promise<FTRequest[]> {
        let query = supabase.from('ft_requests').select('*').order('opened_at', { ascending: false });

        if (filters?.post_id) query = query.eq('post_id', filters.post_id);
        if (filters?.status) query = query.eq('status', filters.status);
        if (filters?.urgency) query = query.eq('urgency', filters.urgency);

        const { data, error } = await query;
        assertNoError(error, 'Erro ao listar FTs');
        return ((data ?? []) as DbRow[]).map(asFT);
      },

      async getById(id: string): Promise<FTRequest | null> {
        const { data, error } = await supabase
          .from('ft_requests')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        assertNoError(error, 'Erro ao buscar FT');
        return data ? asFT(data as DbRow) : null;
      },

      async open(input: OpenFTInput): Promise<FTRequest> {
        const profile = await getCurrentProfile(supabase);

        const { data, error } = await supabase
          .from('ft_requests')
          .insert({
            company_id: profile.company_id,
            post_id: input.post_id,
            schedule_id: input.schedule_id,
            opened_by: input.opened_by || profile.id,
            reason: input.reason,
            urgency: input.urgency,
            status: 'aberta',
            notes: input.notes,
          })
          .select('*')
          .single();

        assertNoError(error, 'Erro ao abrir FT');

        const ft = asFT(data as DbRow);

        const { data: supervisors } = await supabase
          .from('supervisor_posts')
          .select('supervisor_id')
          .eq('post_id', input.post_id);

        for (const supervisor of ((supervisors ?? []) as DbRow[])) {
          if (!supervisor.supervisor_id) continue;

          await supabase.from('alert_log').insert({
            company_id: profile.company_id,
            type: 'ft_aberta',
            target_user_id: supervisor.supervisor_id,
            post_id: input.post_id,
            ft_request_id: ft.id,
            payload: {
              message: `FT aberta: ${input.reason}`,
              urgency: input.urgency,
            },
            channel: 'system',
            status: 'sent',
          });
        }

        return ft;
      },

      async assign(ftId: string, employeeId: string): Promise<FTRequest> {
        const { data, error } = await supabase
          .from('ft_requests')
          .update({
            assigned_to: employeeId,
            status: 'acionando',
            updated_at: new Date().toISOString(),
          })
          .eq('id', ftId)
          .select('*')
          .single();

        assertNoError(error, 'Erro ao acionar funcionário para FT');
        return asFT(data as DbRow);
      },

      async accept(ftId: string): Promise<FTRequest> {
        const { data, error } = await supabase
          .from('ft_requests')
          .update({
            status: 'aceita',
            updated_at: new Date().toISOString(),
          })
          .eq('id', ftId)
          .select('*')
          .single();

        assertNoError(error, 'Erro ao aceitar FT');
        return asFT(data as DbRow);
      },

      async resolve(ftId: string): Promise<FTRequest> {
        const { data, error } = await supabase
          .from('ft_requests')
          .update({
            status: 'resolvida',
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', ftId)
          .select('*')
          .single();

        assertNoError(error, 'Erro ao resolver FT');
        return asFT(data as DbRow);
      },

      async cancel(ftId: string): Promise<FTRequest> {
        const { data, error } = await supabase
          .from('ft_requests')
          .update({
            status: 'cancelada',
            updated_at: new Date().toISOString(),
          })
          .eq('id', ftId)
          .select('*')
          .single();

        assertNoError(error, 'Erro ao cancelar FT');
        return asFT(data as DbRow);
      },

      async getCandidates(_ftId: string): Promise<Profile[]> {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('active', true)
          .eq('ft_available', true)
          .order('name', { ascending: true });

        assertNoError(error, 'Erro ao listar candidatos para FT');
        return ((data ?? []) as DbRow[]).map(normalizeProfile);
      },
    },

    ronda: {
      async getPoints(postId: string): Promise<RondaPointData[]> {
        const { data, error } = await supabase
          .from('ronda_points')
          .select('*')
          .eq('post_id', postId)
          .eq('active', true)
          .order('sequence_order', { ascending: true });

        assertNoError(error, 'Erro ao listar pontos de ronda');
        return ((data ?? []) as DbRow[]).map(asRondaPoint);
      },

      async getLogs(filters?: RondaFilters): Promise<RondaLogData[]> {
        const filtersMeta = filters as RondaFilters & {
          date_from?: string;
          date_to?: string;
        };

        let query = supabase
          .from('ronda_logs')
          .select('*')
          .order('created_at', { ascending: false });

        if (filters?.post_id) query = query.eq('post_id', filters.post_id);
        if (filters?.employee_id) query = query.eq('employee_id', filters.employee_id);
        if (filters?.status) query = query.eq('status', filters.status);
        if (filtersMeta?.date_from) query = query.gte('created_at', filtersMeta.date_from);
        if (filtersMeta?.date_to) query = query.lte('created_at', filtersMeta.date_to);

        const { data, error } = await query;
        assertNoError(error, 'Erro ao listar logs de ronda');
        return ((data ?? []) as DbRow[]).map(asRondaLog);
      },

      async confirmPoint(input: ConfirmRondaInput): Promise<RondaLogData> {
        const { data: existing, error: existingError } = await supabase
          .from('ronda_logs')
          .select('*')
          .eq('idempotency_key', input.idempotency_key)
          .maybeSingle();

        assertNoError(existingError, 'Erro ao verificar idempotência da ronda');

        if (existing) {
          return asRondaLog(existing as DbRow);
        }

        const { data: pointRow, error: pointError } = await supabase
          .from('ronda_points')
          .select('*')
          .eq('id', input.ronda_point_id)
          .eq('active', true)
          .single();

        assertNoError(pointError, 'Erro ao buscar ponto de ronda');

        if (!pointRow) {
          throw new Error('Ponto de ronda não encontrado.');
        }

        const point = asRondaPoint(pointRow as DbRow);

        if (point.require_photo && !input.photo_url) {
          throw new Error('Foto obrigatória para confirmar este ponto de ronda.');
        }

        if (
          typeof input.lat === 'number' &&
          typeof input.lng === 'number'
        ) {
          const check = checkGeofence(
            input.lat,
            input.lng,
            point.lat,
            point.lng,
            point.radius_meters,
          );

          if (!check.within_fence) {
            const distance = haversineDistance(input.lat, input.lng, point.lat, point.lng);
            throw new Error(
              `Fora do raio do ponto de ronda. Distância: ${Math.round(distance)}m (raio: ${point.radius_meters}m)`
            );
          }
        }

        const { data, error } = await supabase
          .from('ronda_logs')
          .insert({
            ronda_point_id: input.ronda_point_id,
            employee_id: input.employee_id,
            post_id: input.post_id,
            status: 'concluida',
            confirmed_at: new Date().toISOString(),
            gps_lat: input.lat,
            gps_lng: input.lng,
            photo_url: input.photo_url,
            notes: input.notes,
            idempotency_key: input.idempotency_key,
          })
          .select('*')
          .single();

        assertNoError(error, 'Erro ao confirmar ponto de ronda');
        return asRondaLog(data as DbRow);
      },
    },

    handover: {
      async list(filters?: HandoverFilters): Promise<HandoverData[]> {
        let query = supabase
          .from('shift_handovers')
          .select('*')
          .order('created_at', { ascending: false });

        if (filters?.post_id) query = query.eq('post_id', filters.post_id);
        if (filters?.status) query = query.eq('status', filters.status);

        const filtersMeta = filters as HandoverFilters & {
          employee_id?: string;
        };

        if (filtersMeta?.employee_id) {
          query = query.or(
            `outgoing_employee_id.eq.${filtersMeta.employee_id},incoming_employee_id.eq.${filtersMeta.employee_id}`
          );
        }

        const { data, error } = await query;
        assertNoError(error, 'Erro ao listar passagens de plantão');
        return ((data ?? []) as DbRow[]).map(asHandover);
      },

      async getById(id: string): Promise<HandoverData | null> {
        const { data, error } = await supabase
          .from('shift_handovers')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        assertNoError(error, 'Erro ao buscar passagem de plantão');
        return data ? asHandover(data as DbRow) : null;
      },

      async create(input: CreateHandoverInput): Promise<HandoverData> {
        const { data, error } = await supabase
          .from('shift_handovers')
          .insert({
            post_id: input.post_id,
            outgoing_employee_id: input.outgoing_employee_id,
            incoming_employee_id: input.incoming_employee_id,
            status: 'pendente',
            notes: input.notes,
            pending_items: input.pending_items ?? [],
          })
          .select('*')
          .single();

        assertNoError(error, 'Erro ao criar passagem de plantão');
        return asHandover(data as DbRow);
      },

      async confirm(id: string): Promise<HandoverData> {
        const { data, error } = await supabase
          .from('shift_handovers')
          .update({
            status: 'confirmada',
            confirmed_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('*')
          .single();

        assertNoError(error, 'Erro ao confirmar passagem de plantão');
        return asHandover(data as DbRow);
      },

      async reportRetention(id: string, reason: string): Promise<HandoverData> {
        const { data, error } = await supabase
          .from('shift_handovers')
          .update({
            status: 'retido',
            retention_reason: reason,
          })
          .eq('id', id)
          .select('*')
          .single();

        assertNoError(error, 'Erro ao registrar retenção na passagem de plantão');
        return asHandover(data as DbRow);
      },
    },

    reports: {
      async getDailyReport(date?: string): Promise<ReportData> {
        const targetDate = date ?? new Date().toISOString().slice(0, 10);
        const occurrences = await countTable(supabase, 'occurrences');
        const criticalOccurrences = await countTable(supabase, 'occurrences', q => q.eq('severity', 'critica'));
        const ftsOpened = await countTable(supabase, 'ft_requests');

        return {
          id: `daily-${targetDate}`,
          type: 'daily',
          title: `Relatório diário — ${targetDate}`,
          date: targetDate,
          posts_total: await countTable(supabase, 'posts', q => q.eq('active', true)),
          posts_covered: 0,
          occurrences_count: occurrences,
          critical_occurrences: criticalOccurrences,
          fts_opened: ftsOpened,
          fts_resolved: await countTable(supabase, 'ft_requests', q => q.eq('status', 'resolvida')),
          sos_count: await countTable(supabase, 'occurrences', q => q.eq('type', 'sos')),
          avg_response_time_min: 0,
          presence_rate: 0,
          ronda_completion: 0,
        };
      },

      async getWeeklyReport(startDate?: string): Promise<ReportData> {
        const report = await this.getDailyReport(startDate);
        return {
          ...report,
          id: `weekly-${startDate ?? new Date().toISOString().slice(0, 10)}`,
          type: 'weekly',
          title: 'Relatório semanal',
        };
      },

      async getDashboardSummary(): Promise<DashboardSummary> {
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('id, min_staff')
          .eq('active', true);

        assertNoError(postsError, 'Erro ao buscar postos para dashboard');

        const { data: presencesData, error: presencesError } = await supabase
          .from('presences')
          .select('id, post_id, status')
          .in('status', ['valid', 'pending_review']);

        assertNoError(presencesError, 'Erro ao buscar presenças para dashboard');

        const { data: sosData, error: sosError } = await supabase
          .from('occurrences')
          .select('id, post_id')
          .eq('type', 'sos')
          .in('status', ['aberta', 'em_tratamento']);

        assertNoError(sosError, 'Erro ao buscar SOS para dashboard');

        const posts = (postsData ?? []) as DbRow[];
        const presences = (presencesData ?? []) as DbRow[];
        const sosRows = (sosData ?? []) as DbRow[];

        const statuses = posts.map((post) => {
          const postId = String(post.id);
          const minStaff = Number(post.min_staff ?? 1);
          const confirmedCount = presences.filter(presence => presence.post_id === postId).length;
          const sosCount = sosRows.filter(sos => sos.post_id === postId).length;

          if (sosCount > 0) return 'sos_ativo';
          if (confirmedCount >= minStaff) return 'coberto';
          if (confirmedCount > 0) return 'parcialmente_coberto';
          return 'descoberto';
        });

        const cobertos = statuses.filter(status => status === 'coberto').length;
        const descobertos = statuses.filter(status => status === 'descoberto').length;
        const parcialmenteCobertos = statuses.filter(status => status === 'parcialmente_coberto').length;
        const sosAtivos = statuses.filter(status => status === 'sos_ativo').length;
        const ftAbertas = await countTable(supabase, 'ft_requests', query => query.in('status', ['aberta', 'acionando']));
        const ocorrenciasCriticas = await countTable(supabase, 'occurrences', query => query.eq('severity', 'critica'));
        const alertasCriticos = await countTable(supabase, 'alert_log', query => query.in('type', ['sos', 'ocorrencia_critica', 'ausencia']));

        return {
          total_posts: posts.length,
          cobertos,
          atencao: parcialmenteCobertos,
          criticos: descobertos + sosAtivos,
          descobertos,
          parcialmente_cobertos: parcialmenteCobertos,
          sos_ativos: sosAtivos,
          ft_abertas: ftAbertas,
          fts_abertas: ftAbertas,
          alertas_criticos: alertasCriticos,
          ocorrencias_hoje: await countTable(supabase, 'occurrences'),
          ocorrencias_criticas: ocorrenciasCriticas,
          presencas_pendentes: await countTable(supabase, 'presences', query => query.eq('status', 'pending_review')),
          rondas_atrasadas: await countTable(supabase, 'ronda_logs', query => query.eq('status', 'atrasada')),
        } as unknown as DashboardSummary;
      },
    },

    notifications: {
      async list(filters?: NotificationFilters): Promise<NotificationData[]> {
        let query = supabase.from('alert_log').select('*').order('created_at', { ascending: false });

        if (filters?.type) query = query.eq('type', filters.type);
        if (filters?.is_read === true) query = query.not('acknowledged_at', 'is', null);
        if (filters?.is_read === false) query = query.is('acknowledged_at', null);

        const { data, error } = await query;
        assertNoError(error, 'Erro ao listar notificações');

        return ((data ?? []) as DbRow[]).map(row => {
          const type = String(row.type ?? 'info');
          return {
            id: String(row.id),
            type,
            title: type.split('_').join(' '),
            message: payloadMessage(row.payload, 'Alerta operacional'),
            severity: notificationSeverity(type),
            is_read: Boolean(row.acknowledged_at),
            created_at: String(row.created_at ?? row.sent_at ?? new Date().toISOString()),
          };
        });
      },
      async markAsRead(id: string): Promise<void> {
        const { error } = await supabase
          .from('alert_log')
          .update({ acknowledged_at: new Date().toISOString(), status: 'acknowledged' })
          .eq('id', id);

        assertNoError(error, 'Erro ao marcar alerta como lido');
      },
      async markAllRead(): Promise<void> {
        const { error } = await supabase
          .from('alert_log')
          .update({ acknowledged_at: new Date().toISOString(), status: 'acknowledged' })
          .is('acknowledged_at', null);

        assertNoError(error, 'Erro ao marcar alertas como lidos');
      },
      async getUnreadCount(): Promise<number> {
        return countTable(supabase, 'alert_log', q => q.is('acknowledged_at', null));
      },
    },

    audit: {
      async write(entry: AuditEntryInput): Promise<void> {
        const { error } = await supabase.from('audit_logs').insert({
          company_id: entry.company_id,
          actor_id: entry.actor_id,
          action: entry.action,
          entity: entry.entity,
          entity_id: entry.entity_id,
          metadata: entry.metadata ?? {},
        });

        assertNoError(error, 'Erro ao gravar auditoria');
      },

      async list(filters?: AuditFilters): Promise<AuditEntryData[]> {
        const filtersMeta = filters as AuditFilters & {
          company_id?: string;
          actor_id?: string;
          date_from?: string;
          date_to?: string;
        };

        let query = supabase
          .from('audit_logs')
          .select('*, profiles:actor_id(name)')
          .order('created_at', { ascending: false });

        if (filtersMeta?.company_id) query = query.eq('company_id', filtersMeta.company_id);
        if (filtersMeta?.actor_id) query = query.eq('actor_id', filtersMeta.actor_id);
        if (filters?.entity) query = query.eq('entity', filters.entity);
        if (filters?.action) query = query.eq('action', filters.action);
        if (filtersMeta?.date_from) query = query.gte('created_at', filtersMeta.date_from);
        if (filtersMeta?.date_to) query = query.lte('created_at', filtersMeta.date_to);

        const { data, error } = await query;
        assertNoError(error, 'Erro ao listar auditoria');
        return ((data ?? []) as DbRow[]).map(asAuditEntry);
      },
    },

    schedules: {
      async list(filters?: ScheduleFilters): Promise<Schedule[]> {
        let query = supabase
          .from('schedules')
          .select('*')
          .order('shift_start', { ascending: true });

        if (filters?.post_id) query = query.eq('post_id', filters.post_id);
        if (filters?.employee_id) query = query.eq('employee_id', filters.employee_id);
        if (filters?.is_active !== undefined) query = query.eq('is_active', filters.is_active);

        const { data, error } = await query;
        assertNoError(error, 'Erro ao listar escalas');
        return ((data ?? []) as DbRow[]).map(asSchedule);
      },

      async getByEmployee(employeeId: string): Promise<Schedule[]> {
        const { data, error } = await supabase
          .from('schedules')
          .select('*')
          .eq('employee_id', employeeId)
          .eq('is_active', true)
          .order('shift_start', { ascending: true });

        assertNoError(error, 'Erro ao listar escalas do funcionário');
        return ((data ?? []) as DbRow[]).map(asSchedule);
      },

      async create(data: Omit<Schedule, 'id' | 'created_at'>): Promise<Schedule> {
        const { data: row, error } = await supabase
          .from('schedules')
          .insert({
            company_id: data.company_id,
            post_id: data.post_id,
            employee_id: data.employee_id,
            shift_start: data.shift_start,
            shift_end: data.shift_end,
            regime: data.regime,
            cycle_reference_date: data.cycle_reference_date,
            weekdays: data.weekdays,
            template_id: data.template_id,
            is_active: data.is_active,
            status: data.status,
          })
          .select('*')
          .single();

        assertNoError(error, 'Erro ao criar escala');
        return asSchedule(row as DbRow);
      },

      async detectConflicts(employeeId: string): Promise<ScheduleConflictData[]> {
        const schedules = await this.getByEmployee(employeeId);
        const activeSchedules = schedules
          .filter(schedule => schedule.is_active && schedule.status === 'active')
          .sort((a, b) => new Date(a.shift_start).getTime() - new Date(b.shift_start).getTime());

        const conflicts: ScheduleConflictData[] = [];

        for (let i = 0; i < activeSchedules.length; i += 1) {
          for (let j = i + 1; j < activeSchedules.length; j += 1) {
            const first = activeSchedules[i];
            const second = activeSchedules[j];

            const firstStart = new Date(first.shift_start).getTime();
            const firstEnd = new Date(first.shift_end).getTime();
            const secondStart = new Date(second.shift_start).getTime();
            const secondEnd = new Date(second.shift_end).getTime();

            const overlaps = firstStart < secondEnd && secondStart < firstEnd;

            if (!overlaps) continue;

            const overlapStartMs = Math.max(firstStart, secondStart);
            const overlapEndMs = Math.min(firstEnd, secondEnd);

            const firstInsideSecond = firstStart >= secondStart && firstEnd <= secondEnd;
            const secondInsideFirst = secondStart >= firstStart && secondEnd <= firstEnd;

            conflicts.push({
              schedule_id_1: first.id,
              schedule_id_2: second.id,
              post_id_1: first.post_id,
              post_id_2: second.post_id,
              overlap_start: new Date(overlapStartMs).toISOString(),
              overlap_end: new Date(overlapEndMs).toISOString(),
              conflict_type: firstInsideSecond || secondInsideFirst ? 'full' : 'partial',
            });
          }
        }

        return conflicts;
      },
    },
  };
}
