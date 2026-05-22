// ============================================================
// OPERACIONAL5 — Demo Data Adapter
// ============================================================
// Adaptador LOCAL para desenvolvimento sem Supabase.
// TODOS os dados mockados ficam AQUI. As páginas NUNCA
// importam mockData diretamente — consomem via repositories.
// ============================================================

import type { IDataProvider } from '../data-provider';
import {
  DEMO_POSTS, DEMO_PROFILES, DEMO_PRESENCES, DEMO_OCCURRENCES,
  DEMO_FT_REQUESTS, DEMO_POST_STATUS, DEMO_DASHBOARD,
  DEMO_RONDA_POINTS, DEMO_RONDA_LOGS, DEMO_HANDOVERS,
  DEMO_NOTIFICATIONS, DEMO_REPORTS,
  getProfileName,
} from '../../mockData';
import { haversineDistance, checkGeofence } from '../../geo';
import type {
  Post, Profile, Presence, Occurrence, FTRequest,
  OperationalPostStatus, Schedule,
} from '../../types';
import type {
  PostFilters, EmployeeFilters, PresenceFilters, OccurrenceFilters,
  FTFilters, RondaFilters, HandoverFilters, NotificationFilters,
  AuditFilters, ScheduleFilters,
  ConfirmPresenceInput, PresenceResult, CreateOccurrenceInput,
  TriggerSOSInput, OpenFTInput, RondaPointData, RondaLogData,
  ConfirmRondaInput, HandoverData, CreateHandoverInput, ReportData,
  NotificationData, AuditEntryInput, AuditEntryData, ScheduleConflictData,
} from '../data-provider';

// --- Local state (mutável para simular persistência) ---
let _posts = [...DEMO_POSTS];
let _profiles = [...DEMO_PROFILES];
let _presences = [...DEMO_PRESENCES];
let _occurrences = [...DEMO_OCCURRENCES];
let _ftRequests = [...DEMO_FT_REQUESTS];
let _rondaLogs = [...DEMO_RONDA_LOGS];
let _handovers = [...DEMO_HANDOVERS];
let _notifications = DEMO_NOTIFICATIONS.map(n => ({ ...n }));
let _auditEntries: AuditEntryData[] = [];
let _schedules: Schedule[] = [];

function recentTime(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60000).toISOString();
}

function todayShiftStart(): string {
  const d = new Date(); d.setHours(6, 0, 0, 0); return d.toISOString();
}
function todayShiftEnd(): string {
  const d = new Date(); d.setHours(18, 0, 0, 0); return d.toISOString();
}

// ==================== POSTS ====================
const postsRepo = {
  async list(filters?: PostFilters): Promise<Post[]> {
    let result = _posts.filter(p => p.active);
    if (filters?.company_id) result = result.filter(p => p.company_id === filters.company_id);
    if (filters?.client_id) result = result.filter(p => p.client_id === filters.client_id);
    return result;
  },
  async getById(id: string): Promise<Post | null> {
    return _posts.find(p => p.id === id) ?? null;
  },
  async create(data: Omit<Post, 'id' | 'created_at' | 'updated_at' | 'qr_code_token'>): Promise<Post> {
    const post: Post = {
      ...data, id: `post-${Date.now()}`,
      qr_code_token: `qr-${Date.now()}`,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } as Post;
    _posts.push(post);
    return post;
  },
  async update(id: string, data: Partial<Post>): Promise<Post> {
    const idx = _posts.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Post not found');
    _posts[idx] = { ..._posts[idx], ...data, updated_at: new Date().toISOString() };
    return _posts[idx];
  },
  async getOperationalStatuses(): Promise<OperationalPostStatus[]> {
    return DEMO_POST_STATUS;
  },
  async getOperationalStatus(postId: string): Promise<OperationalPostStatus | null> {
    return DEMO_POST_STATUS.find(s => s.post_id === postId) ?? null;
  },
};

// ==================== EMPLOYEES ====================
const employeesRepo = {
  async list(filters?: EmployeeFilters): Promise<Profile[]> {
    let result = [..._profiles];
    if (filters?.role) result = result.filter(p => p.role === filters.role);
    if (filters?.ft_available) result = result.filter(p => p.ft_available);
    if (filters?.active !== undefined) result = result.filter(p => p.active === filters.active);
    return result;
  },
  async getById(id: string): Promise<Profile | null> {
    return _profiles.find(p => p.id === id) ?? null;
  },
  async create(data: Omit<Profile, 'id' | 'created_at' | 'updated_at'>): Promise<Profile> {
    const profile: Profile = {
      ...data, id: `prof-${Date.now()}`,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } as Profile;
    _profiles.push(profile);
    return profile;
  },
  async update(id: string, data: Partial<Profile>): Promise<Profile> {
    const idx = _profiles.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Profile not found');
    _profiles[idx] = { ..._profiles[idx], ...data, updated_at: new Date().toISOString() };
    return _profiles[idx];
  },
  async getAvailableForFT(): Promise<Profile[]> {
    return _profiles.filter(p => p.ft_available && p.active);
  },
};

// ==================== PRESENCE ====================
const presenceRepo = {
  async confirm(input: ConfirmPresenceInput): Promise<PresenceResult> {
    const post = _posts.find(p => p.id === input.post_id);
    if (!post) return { success: false, presence: null, message: 'Posto não encontrado', status: 'rejected' };

    // Check idempotency
    const existing = _presences.find(p => p.idempotency_key === input.idempotency_key);
    if (existing) return { success: true, presence: existing, message: 'Presença já registrada', status: 'approved' };

    let distance = 0;
    let withinFence = false;
    let status: PresenceResult['status'] = 'approved';

    if (input.method === 'gps' && input.lat && input.lng) {
      distance = haversineDistance(input.lat, input.lng, post.lat, post.lng);
      const check = checkGeofence(input.lat, input.lng, post.lat, post.lng, post.radius_meters, input.accuracy);
      withinFence = check.within_fence;

      if (check.mock_detected) {
        status = 'rejected';
        return { success: false, presence: null, message: `GPS falso detectado: ${check.mock_reasons.join(', ')}`, status, distance_meters: distance };
      }
      if (!withinFence) {
        status = 'rejected';
        return { success: false, presence: null, message: `Fora do raio do posto. Distância: ${Math.round(distance)}m (raio: ${post.radius_meters}m)`, status, distance_meters: distance };
      }
      if (!check.accuracy_ok) {
        status = 'pending_review';
      }
    }

    if (input.method === 'qr' && input.qr_code_token !== post.qr_code_token) {
      return { success: false, presence: null, message: 'QR Code inválido para este posto', status: 'rejected' };
    }

    const presence: Presence = {
      id: `pres-${Date.now()}`,
      schedule_id: input.schedule_id,
      employee_id: input.employee_id,
      post_id: input.post_id,
      confirmed_at: new Date().toISOString(),
      gps_lat: input.lat, gps_lng: input.lng,
      gps_valid: withinFence,
      accuracy: input.accuracy,
      validation_method: input.method,
      photo_url: input.photo_url,
      is_mock_location: input.is_mock_location ?? false,
      status: status === 'approved' ? 'valid' : status === 'pending_review' ? 'pending_review' : 'rejected',
      idempotency_key: input.idempotency_key,
      created_at: new Date().toISOString(),
    };
    _presences.push(presence);

    return { success: true, presence, message: status === 'approved' ? 'Presença confirmada!' : 'Presença registrada para revisão', status, distance_meters: distance };
  },
  async list(filters?: PresenceFilters): Promise<Presence[]> {
    let result = [..._presences];
    if (filters?.post_id) result = result.filter(p => p.post_id === filters.post_id);
    if (filters?.employee_id) result = result.filter(p => p.employee_id === filters.employee_id);
    if (filters?.method) result = result.filter(p => p.validation_method === filters.method);
    if (filters?.status) result = result.filter(p => p.status === filters.status);
    return result;
  },
  async getById(id: string): Promise<Presence | null> {
    return _presences.find(p => p.id === id) ?? null;
  },
};

// ==================== OCCURRENCES ====================
const occurrencesRepo = {
  async create(input: CreateOccurrenceInput): Promise<Occurrence> {
    const existing = _occurrences.find(o => o.idempotency_key === input.idempotency_key);
    if (existing) return existing;

    const occ: Occurrence = {
      id: `occ-${Date.now()}`, company_id: 'comp-001',
      post_id: input.post_id, employee_id: input.employee_id,
      type: input.type, severity: input.severity,
      description: input.description, photo_url: input.photo_url,
      gps_lat: input.lat, gps_lng: input.lng,
      status: 'aberta',
      idempotency_key: input.idempotency_key,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    _occurrences.push(occ);
    return occ;
  },
  async list(filters?: OccurrenceFilters): Promise<Occurrence[]> {
    let result = [..._occurrences];
    if (filters?.post_id) result = result.filter(o => o.post_id === filters.post_id);
    if (filters?.severity) result = result.filter(o => o.severity === filters.severity);
    if (filters?.status) result = result.filter(o => o.status === filters.status);
    return result;
  },
  async getById(id: string): Promise<Occurrence | null> {
    return _occurrences.find(o => o.id === id) ?? null;
  },
  async acknowledge(id: string, _role: string): Promise<Occurrence> {
    const idx = _occurrences.findIndex(o => o.id === id);
    if (idx === -1) throw new Error('Occurrence not found');
    if (_role === 'supervisor') _occurrences[idx].ack_supervisor = _role;
    if (_role === 'gerente') _occurrences[idx].ack_gerente = _role;
    _occurrences[idx].status = 'em_tratamento';
    _occurrences[idx].updated_at = new Date().toISOString();
    return _occurrences[idx];
  },
  async resolve(id: string, resolvedBy: string): Promise<Occurrence> {
    const idx = _occurrences.findIndex(o => o.id === id);
    if (idx === -1) throw new Error('Occurrence not found');
    _occurrences[idx].status = 'resolvida';
    _occurrences[idx].resolved_by = resolvedBy;
    _occurrences[idx].resolved_at = new Date().toISOString();
    _occurrences[idx].updated_at = new Date().toISOString();
    return _occurrences[idx];
  },
};

// ==================== SOS ====================
const sosRepo = {
  async trigger(input: TriggerSOSInput): Promise<Occurrence> {
    const occ: Occurrence = {
      id: `occ-sos-${Date.now()}`, company_id: 'comp-001',
      post_id: input.post_id, employee_id: input.employee_id,
      type: 'sos', severity: 'critica',
      description: `SOS disparado por ${getProfileName(input.employee_id)}`,
      gps_lat: input.lat, gps_lng: input.lng,
      status: 'aberta',
      idempotency_key: input.idempotency_key,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    _occurrences.push(occ);
    return occ;
  },
  async close(occurrenceId: string, closedBy: string, _resolution: string): Promise<Occurrence> {
    const idx = _occurrences.findIndex(o => o.id === occurrenceId);
    if (idx === -1) throw new Error('SOS not found');
    _occurrences[idx].status = 'resolvida';
    _occurrences[idx].resolved_by = closedBy;
    _occurrences[idx].resolved_at = new Date().toISOString();
    _occurrences[idx].updated_at = new Date().toISOString();
    return _occurrences[idx];
  },
  async getActive(): Promise<Occurrence[]> {
    return _occurrences.filter(o => o.type === 'sos' && o.status === 'aberta');
  },
};

// ==================== FT ====================
const ftRepo = {
  async list(filters?: FTFilters): Promise<FTRequest[]> {
    let result = [..._ftRequests];
    if (filters?.post_id) result = result.filter(f => f.post_id === filters.post_id);
    if (filters?.status) result = result.filter(f => f.status === filters.status);
    return result;
  },
  async getById(id: string): Promise<FTRequest | null> {
    return _ftRequests.find(f => f.id === id) ?? null;
  },
  async open(input: OpenFTInput): Promise<FTRequest> {
    const ft: FTRequest = {
      id: `ft-${Date.now()}`, company_id: 'comp-001',
      post_id: input.post_id, schedule_id: input.schedule_id,
      opened_by: input.opened_by, reason: input.reason,
      urgency: input.urgency, status: 'aberta',
      opened_at: new Date().toISOString(), notes: input.notes,
      created_at: new Date().toISOString(),
    };
    _ftRequests.push(ft);
    return ft;
  },
  async assign(ftId: string, employeeId: string): Promise<FTRequest> {
    const idx = _ftRequests.findIndex(f => f.id === ftId);
    if (idx === -1) throw new Error('FT not found');
    _ftRequests[idx].assigned_to = employeeId;
    _ftRequests[idx].status = 'acionando';
    return _ftRequests[idx];
  },
  async accept(ftId: string): Promise<FTRequest> {
    const idx = _ftRequests.findIndex(f => f.id === ftId);
    if (idx === -1) throw new Error('FT not found');
    _ftRequests[idx].status = 'aceita';
    return _ftRequests[idx];
  },
  async resolve(ftId: string): Promise<FTRequest> {
    const idx = _ftRequests.findIndex(f => f.id === ftId);
    if (idx === -1) throw new Error('FT not found');
    _ftRequests[idx].status = 'resolvida';
    _ftRequests[idx].resolved_at = new Date().toISOString();
    return _ftRequests[idx];
  },
  async cancel(ftId: string): Promise<FTRequest> {
    const idx = _ftRequests.findIndex(f => f.id === ftId);
    if (idx === -1) throw new Error('FT not found');
    _ftRequests[idx].status = 'cancelada';
    return _ftRequests[idx];
  },
  async getCandidates(_ftId: string): Promise<Profile[]> {
    return _profiles.filter(p => p.ft_available && p.active);
  },
};

// ==================== RONDA ====================
const rondaRepo = {
  async getPoints(postId: string): Promise<RondaPointData[]> {
    return DEMO_RONDA_POINTS.filter(p => p.post_id === postId);
  },
  async getLogs(filters?: RondaFilters): Promise<RondaLogData[]> {
    let result = [..._rondaLogs];
    if (filters?.post_id) result = result.filter(l => l.post_id === filters.post_id);
    if (filters?.status) result = result.filter(l => l.status === filters.status);
    return result;
  },
  async confirmPoint(input: ConfirmRondaInput): Promise<RondaLogData> {
    const log: RondaLogData = {
      id: `rl-${Date.now()}`,
      ronda_point_id: input.ronda_point_id,
      employee_id: input.employee_id,
      post_id: input.post_id,
      status: 'concluida',
      confirmed_at: new Date().toISOString(),
      gps_lat: input.lat, gps_lng: input.lng,
      notes: input.notes,
      created_at: new Date().toISOString(),
    };
    _rondaLogs.push(log);
    return log;
  },
};

// ==================== HANDOVER ====================
const handoverRepo = {
  async list(filters?: HandoverFilters): Promise<HandoverData[]> {
    let result = [..._handovers];
    if (filters?.post_id) result = result.filter(h => h.post_id === filters.post_id);
    if (filters?.status) result = result.filter(h => h.status === filters.status);
    return result;
  },
  async getById(id: string): Promise<HandoverData | null> {
    return _handovers.find(h => h.id === id) ?? null;
  },
  async create(input: CreateHandoverInput): Promise<HandoverData> {
    const h: HandoverData = {
      id: `sh-${Date.now()}`,
      post_id: input.post_id,
      outgoing_employee_id: input.outgoing_employee_id,
      incoming_employee_id: input.incoming_employee_id,
      status: 'pendente',
      notes: input.notes,
      pending_items: input.pending_items ?? [],
      created_at: new Date().toISOString(),
    };
    _handovers.push(h);
    return h;
  },
  async confirm(id: string): Promise<HandoverData> {
    const idx = _handovers.findIndex(h => h.id === id);
    if (idx === -1) throw new Error('Handover not found');
    _handovers[idx].status = 'confirmada';
    _handovers[idx].confirmed_at = new Date().toISOString();
    return _handovers[idx];
  },
  async reportRetention(id: string, reason: string): Promise<HandoverData> {
    const idx = _handovers.findIndex(h => h.id === id);
    if (idx === -1) throw new Error('Handover not found');
    _handovers[idx].status = 'retido';
    _handovers[idx].retention_reason = reason;
    return _handovers[idx];
  },
};

// ==================== REPORTS ====================
const reportsRepo = {
  async getDailyReport(_date?: string): Promise<ReportData> {
    return DEMO_REPORTS[0];
  },
  async getWeeklyReport(_startDate?: string): Promise<ReportData> {
    return DEMO_REPORTS[2];
  },
  async getDashboardSummary() {
    return DEMO_DASHBOARD;
  },
};

// ==================== NOTIFICATIONS ====================
const notificationsRepo = {
  async list(filters?: NotificationFilters): Promise<NotificationData[]> {
    let result = [..._notifications];
    if (filters?.is_read === false) result = result.filter(n => !n.is_read);
    if (filters?.is_read === true) result = result.filter(n => n.is_read);
    return result;
  },
  async markAsRead(id: string): Promise<void> {
    const n = _notifications.find(n => n.id === id);
    if (n) n.is_read = true;
  },
  async markAllRead(): Promise<void> {
    _notifications.forEach(n => { n.is_read = true; });
  },
  async getUnreadCount(): Promise<number> {
    return _notifications.filter(n => !n.is_read).length;
  },
};

// ==================== AUDIT ====================
const auditRepo = {
  async write(entry: AuditEntryInput): Promise<void> {
    _auditEntries.push({
      ...entry,
      id: `aud-${Date.now()}`,
      actor_name: getProfileName(entry.actor_id),
      created_at: new Date().toISOString(),
    });
  },
  async list(filters?: AuditFilters): Promise<AuditEntryData[]> {
    let result = [..._auditEntries];
    if (filters?.entity) result = result.filter(a => a.entity === filters.entity);
    if (filters?.action) result = result.filter(a => a.action === filters.action);
    return result;
  },
};

// ==================== SCHEDULES ====================
const schedulesRepo = {
  async list(filters?: ScheduleFilters): Promise<Schedule[]> {
    if (_schedules.length === 0) {
      // Lazy init com dados demo
      _schedules = [
        { id: 'sched-001', company_id: 'comp-001', post_id: 'post-001', employee_id: 'prof-004', shift_start: todayShiftStart(), shift_end: todayShiftEnd(), regime: '12x36', cycle_reference_date: '2024-01-01', is_active: true, status: 'active', created_at: recentTime(1440) },
        { id: 'sched-002', company_id: 'comp-001', post_id: 'post-002', employee_id: 'prof-005', shift_start: todayShiftStart(), shift_end: todayShiftEnd(), regime: '12x36', cycle_reference_date: '2024-01-02', is_active: true, status: 'active', created_at: recentTime(1440) },
        { id: 'sched-003', company_id: 'comp-001', post_id: 'post-003', employee_id: 'prof-006', shift_start: todayShiftStart(), shift_end: todayShiftEnd(), regime: '12x36', cycle_reference_date: '2024-01-03', is_active: true, status: 'active', created_at: recentTime(1440) },
      ];
    }
    let result = [..._schedules];
    if (filters?.post_id) result = result.filter(s => s.post_id === filters.post_id);
    if (filters?.employee_id) result = result.filter(s => s.employee_id === filters.employee_id);
    return result;
  },
  async getByEmployee(employeeId: string): Promise<Schedule[]> {
    return _schedules.filter(s => s.employee_id === employeeId);
  },
  async create(data: Omit<Schedule, 'id' | 'created_at'>): Promise<Schedule> {
    const sched: Schedule = { ...data, id: `sched-${Date.now()}`, created_at: new Date().toISOString() } as Schedule;
    _schedules.push(sched);
    return sched;
  },
  async detectConflicts(_employeeId: string): Promise<ScheduleConflictData[]> {
    return []; // Demo: sem conflitos
  },
};

// ==================== FACTORY ====================
export function createDemoAdapter(): IDataProvider {
  return {
    posts: postsRepo,
    employees: employeesRepo,
    presence: presenceRepo,
    occurrences: occurrencesRepo,
    sos: sosRepo,
    ft: ftRepo,
    ronda: rondaRepo,
    handover: handoverRepo,
    reports: reportsRepo,
    notifications: notificationsRepo,
    audit: auditRepo,
    schedules: schedulesRepo,
  };
}
