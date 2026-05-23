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

function failNotImplemented(feature: string): Promise<never> {
  return Promise.reject(new Error(`SupabaseAdapter: ${feature} ainda não implementado nesta etapa.`));
}

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
      confirm(_input: ConfirmPresenceInput): Promise<PresenceResult> {
        return failNotImplemented('presence.confirm será implementado na etapa 4/10');
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
      create(_input: CreateOccurrenceInput): Promise<Occurrence> {
        return failNotImplemented('occurrences.create será implementado na etapa 5/10');
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

      acknowledge(_id: string, _role: Role): Promise<Occurrence> {
        return failNotImplemented('occurrences.acknowledge será implementado em etapa posterior');
      },

      resolve(_id: string, _resolvedBy: string): Promise<Occurrence> {
        return failNotImplemented('occurrences.resolve será implementado em etapa posterior');
      },
    },

    sos: {
      trigger(_input: TriggerSOSInput): Promise<Occurrence> {
        return failNotImplemented('sos.trigger será implementado em etapa posterior');
      },
      close(_occurrenceId: string, _closedBy: string, _resolution: string): Promise<Occurrence> {
        return failNotImplemented('sos.close será implementado em etapa posterior');
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
        const { data, error } = await supabase.from('ft_requests').select('*').eq('id', id).maybeSingle();
        assertNoError(error, 'Erro ao buscar FT');
        return data ? asFT(data as DbRow) : null;
      },
      open(_input: OpenFTInput): Promise<FTRequest> {
        return failNotImplemented('ft.open será implementado em etapa posterior');
      },
      assign(_ftId: string, _employeeId: string): Promise<FTRequest> {
        return failNotImplemented('ft.assign será implementado em etapa posterior');
      },
      accept(_ftId: string): Promise<FTRequest> {
        return failNotImplemented('ft.accept será implementado em etapa posterior');
      },
      resolve(_ftId: string): Promise<FTRequest> {
        return failNotImplemented('ft.resolve será implementado em etapa posterior');
      },
      cancel(_ftId: string): Promise<FTRequest> {
        return failNotImplemented('ft.cancel será implementado em etapa posterior');
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
      getPoints(_postId: string): Promise<RondaPointData[]> {
        return failNotImplemented('ronda.getPoints será implementado em etapa posterior');
      },
      getLogs(): Promise<RondaLogData[]> {
        return failNotImplemented('ronda.getLogs será implementado em etapa posterior');
      },
      confirmPoint(_input: ConfirmRondaInput): Promise<RondaLogData> {
        return failNotImplemented('ronda.confirmPoint será implementado em etapa posterior');
      },
    },

    handover: {
      list(): Promise<HandoverData[]> {
        return failNotImplemented('handover.list será implementado em etapa posterior');
      },
      getById(_id: string): Promise<HandoverData | null> {
        return failNotImplemented('handover.getById será implementado em etapa posterior');
      },
      create(_input: CreateHandoverInput): Promise<HandoverData> {
        return failNotImplemented('handover.create será implementado em etapa posterior');
      },
      confirm(_id: string): Promise<HandoverData> {
        return failNotImplemented('handover.confirm será implementado em etapa posterior');
      },
      reportRetention(_id: string, _reason: string): Promise<HandoverData> {
        return failNotImplemented('handover.reportRetention será implementado em etapa posterior');
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
      write(_entry: AuditEntryInput): Promise<void> {
        return failNotImplemented('audit.write será implementado em etapa posterior');
      },
      list(): Promise<AuditEntryData[]> {
        return failNotImplemented('audit.list será implementado em etapa posterior');
      },
    },

    schedules: {
      async list(filters?: ScheduleFilters): Promise<Schedule[]> {
        let query = supabase.from('schedules').select('*').order('shift_start', { ascending: true });

        if (filters?.post_id) query = query.eq('post_id', filters.post_id);
        if (filters?.employee_id) query = query.eq('employee_id', filters.employee_id);
        if (filters?.is_active !== undefined) query = query.eq('is_active', filters.is_active);

        const { data, error } = await query;
        assertNoError(error, 'Erro ao listar escalas');
        return ((data ?? []) as DbRow[]).map(asSchedule);
      },
      async getByEmployee(employeeId: string): Promise<Schedule[]> {
        return this.list({ employee_id: employeeId });
      },
      create(_data: Omit<Schedule, 'id' | 'created_at'>): Promise<Schedule> {
        return failNotImplemented('schedules.create será implementado em etapa posterior');
      },
      detectConflicts(_employeeId: string): Promise<ScheduleConflictData[]> {
        return Promise.resolve([]);
      },
    },
  };
}
