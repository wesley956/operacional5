// ============================================================
// OPERACIONAL5 — Data Provider (Camada de Dados Abstrata)
// ============================================================
// Este é o ponto central da camada de dados. Toda página/service
// consome dados através desta interface, NUNCA diretamente de mockData.
//
// Modo DEMO: usa DemoDataAdapter (localStorage + mockData)
// Modo PROD: usa SupabaseDataAdapter (Supabase Auth + PostgreSQL)
// ============================================================

import type {
  Profile, Post, Schedule, Presence,
  Occurrence, FTRequest, OperationalPostStatus,
  DashboardSummary, Role, PresenceMethod, Severity,
  OccurrenceType, FTReason, HandoverStatus,
} from '../types';

// --- Repository Interfaces ---

export interface IPostsRepository {
  list(filters?: PostFilters): Promise<Post[]>;
  getById(id: string): Promise<Post | null>;
  create(data: Omit<Post, 'id' | 'created_at' | 'updated_at' | 'qr_code_token'>): Promise<Post>;
  update(id: string, data: Partial<Post>): Promise<Post>;
  getOperationalStatuses(): Promise<OperationalPostStatus[]>;
  getOperationalStatus(postId: string): Promise<OperationalPostStatus | null>;
}

export interface IEmployeesRepository {
  list(filters?: EmployeeFilters): Promise<Profile[]>;
  getById(id: string): Promise<Profile | null>;
  create(data: Omit<Profile, 'id' | 'created_at' | 'updated_at'>): Promise<Profile>;
  update(id: string, data: Partial<Profile>): Promise<Profile>;
  getAvailableForFT(): Promise<Profile[]>;
}

export interface IPresenceRepository {
  confirm(input: ConfirmPresenceInput): Promise<PresenceResult>;
  list(filters?: PresenceFilters): Promise<Presence[]>;
  getById(id: string): Promise<Presence | null>;
}

export interface IOccurrencesRepository {
  create(input: CreateOccurrenceInput): Promise<Occurrence>;
  list(filters?: OccurrenceFilters): Promise<Occurrence[]>;
  getById(id: string): Promise<Occurrence | null>;
  acknowledge(id: string, role: Role): Promise<Occurrence>;
  resolve(id: string, resolvedBy: string): Promise<Occurrence>;
}

export interface ISOSRepository {
  trigger(input: TriggerSOSInput): Promise<Occurrence>;
  close(occurrenceId: string, closedBy: string, resolution: string): Promise<Occurrence>;
  getActive(): Promise<Occurrence[]>;
}

export interface IFTRepository {
  list(filters?: FTFilters): Promise<FTRequest[]>;
  getById(id: string): Promise<FTRequest | null>;
  open(input: OpenFTInput): Promise<FTRequest>;
  assign(ftId: string, employeeId: string): Promise<FTRequest>;
  accept(ftId: string): Promise<FTRequest>;
  resolve(ftId: string): Promise<FTRequest>;
  cancel(ftId: string): Promise<FTRequest>;
  getCandidates(ftId: string): Promise<Profile[]>;
}

export interface IRondaRepository {
  getPoints(postId: string): Promise<RondaPointData[]>;
  getLogs(filters?: RondaFilters): Promise<RondaLogData[]>;
  confirmPoint(input: ConfirmRondaInput): Promise<RondaLogData>;
}

export interface IHandoverRepository {
  list(filters?: HandoverFilters): Promise<HandoverData[]>;
  getById(id: string): Promise<HandoverData | null>;
  create(input: CreateHandoverInput): Promise<HandoverData>;
  confirm(id: string): Promise<HandoverData>;
  reportRetention(id: string, reason: string): Promise<HandoverData>;
}

export interface IReportsRepository {
  getDailyReport(date?: string): Promise<ReportData>;
  getWeeklyReport(startDate?: string): Promise<ReportData>;
  getDashboardSummary(): Promise<DashboardSummary>;
}

export interface INotificationsRepository {
  list(filters?: NotificationFilters): Promise<NotificationData[]>;
  markAsRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;
  getUnreadCount(): Promise<number>;
}

export interface IAuditRepository {
  write(entry: AuditEntryInput): Promise<void>;
  list(filters?: AuditFilters): Promise<AuditEntryData[]>;
}

export interface ISchedulesRepository {
  list(filters?: ScheduleFilters): Promise<Schedule[]>;
  getByEmployee(employeeId: string): Promise<Schedule[]>;
  create(data: Omit<Schedule, 'id' | 'created_at'>): Promise<Schedule>;
  detectConflicts(employeeId: string): Promise<ScheduleConflictData[]>;
}

// --- Input/Output Types ---

export interface PostFilters {
  company_id?: string;
  client_id?: string;
  active?: boolean;
}

export interface EmployeeFilters {
  company_id?: string;
  role?: Role;
  active?: boolean;
  ft_available?: boolean;
}

export interface PresenceFilters {
  post_id?: string;
  employee_id?: string;
  method?: PresenceMethod;
  status?: string;
  date_from?: string;
  date_to?: string;
}

export interface OccurrenceFilters {
  post_id?: string;
  employee_id?: string;
  type?: OccurrenceType;
  severity?: Severity;
  status?: string;
}

export interface FTFilters {
  post_id?: string;
  status?: string;
  urgency?: Severity;
}

export interface RondaFilters {
  post_id?: string;
  employee_id?: string;
  status?: string;
}

export interface HandoverFilters {
  post_id?: string;
  status?: HandoverStatus;
}

export interface NotificationFilters {
  is_read?: boolean;
  type?: string;
}

export interface AuditFilters {
  entity?: string;
  action?: string;
  date_from?: string;
  date_to?: string;
}

export interface ScheduleFilters {
  post_id?: string;
  employee_id?: string;
  is_active?: boolean;
}

export interface ConfirmPresenceInput {
  schedule_id?: string;
  post_id: string;
  employee_id: string;
  method: PresenceMethod;
  lat?: number;
  lng?: number;
  accuracy?: number;
  qr_code_token?: string;
  nfc_uid?: string;
  photo_url?: string;
  device_info?: string;
  is_mock_location?: boolean;
  idempotency_key: string;
}

export interface PresenceResult {
  success: boolean;
  presence: Presence | null;
  message: string;
  status: 'approved' | 'pending_review' | 'rejected';
  distance_meters?: number;
}

export interface CreateOccurrenceInput {
  post_id: string;
  employee_id: string;
  type: OccurrenceType;
  severity: Severity;
  description?: string;
  photo_url?: string;
  lat?: number;
  lng?: number;
  idempotency_key: string;
}

export interface TriggerSOSInput {
  post_id: string;
  employee_id: string;
  lat?: number;
  lng?: number;
  idempotency_key: string;
}

export interface OpenFTInput {
  post_id: string;
  schedule_id?: string;
  opened_by: string;
  reason: FTReason;
  urgency: Severity;
  notes?: string;
}

export interface RondaPointData {
  id: string;
  post_id: string;
  name: string;
  lat: number;
  lng: number;
  radius_meters: number;
  sequence_order: number;
  require_photo: boolean;
  qr_code_token: string;
  active: boolean;
}

export interface RondaLogData {
  id: string;
  ronda_point_id: string;
  employee_id: string;
  post_id: string;
  status: 'concluida' | 'atrasada' | 'pendente' | 'perdida';
  confirmed_at?: string;
  gps_lat?: number;
  gps_lng?: number;
  notes?: string;
  created_at: string;
}

export interface ConfirmRondaInput {
  ronda_point_id: string;
  employee_id: string;
  post_id: string;
  lat?: number;
  lng?: number;
  photo_url?: string;
  notes?: string;
  idempotency_key: string;
}

export interface HandoverData {
  id: string;
  post_id: string;
  outgoing_employee_id: string;
  incoming_employee_id: string;
  status: 'pendente' | 'confirmada' | 'retido';
  notes?: string;
  pending_items: string[];
  retention_reason?: string;
  confirmed_at?: string;
  created_at: string;
}

export interface CreateHandoverInput {
  post_id: string;
  outgoing_employee_id: string;
  incoming_employee_id: string;
  notes?: string;
  pending_items?: string[];
}

export interface ReportData {
  id: string;
  type: 'daily' | 'weekly' | 'monthly' | 'incident';
  title: string;
  date: string;
  posts_total: number;
  posts_covered: number;
  occurrences_count: number;
  critical_occurrences: number;
  fts_opened: number;
  fts_resolved: number;
  sos_count: number;
  avg_response_time_min: number;
  presence_rate: number;
  ronda_completion: number;
}

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'danger' | 'critical';
  post_name?: string;
  employee_name?: string;
  is_read: boolean;
  created_at: string;
  action_url?: string;
}

export interface AuditEntryInput {
  company_id: string;
  actor_id: string;
  action: string;
  entity: string;
  entity_id: string;
  metadata?: Record<string, unknown>;
}

export interface AuditEntryData {
  id: string;
  company_id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  entity: string;
  entity_id: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ScheduleConflictData {
  schedule_id_1: string;
  schedule_id_2: string;
  post_id_1: string;
  post_id_2: string;
  overlap_start: string;
  overlap_end: string;
  conflict_type: 'full' | 'partial';
}

// --- Data Provider Interface ---

export interface IDataProvider {
  posts: IPostsRepository;
  employees: IEmployeesRepository;
  presence: IPresenceRepository;
  occurrences: IOccurrencesRepository;
  sos: ISOSRepository;
  ft: IFTRepository;
  ronda: IRondaRepository;
  handover: IHandoverRepository;
  reports: IReportsRepository;
  notifications: INotificationsRepository;
  audit: IAuditRepository;
  schedules: ISchedulesRepository;
}

// --- Data Provider Factory ---

// Singleton — será preenchido pelo DemoAdapter ou SupabaseAdapter
let _provider: IDataProvider | undefined;

export function setDataProvider(provider: IDataProvider): void {
  _provider = provider;
}

export function getDataProvider(): IDataProvider {
  if (!_provider) {
    // Lazy init: carrega demo adapter por padrão
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('./adapters/demo-adapter');
    _provider = mod.createDemoAdapter();
  }
  return _provider!;
}

export function hasDataProvider(): boolean {
  return _provider !== undefined;
}
