// ============================================================
// OPERACIONAL5 — Tipos Compartilhados
// ============================================================

// --- Enums ---
export type Role = 'operador' | 'lider' | 'supervisor' | 'gerente' | 'diretor' | 'admin';
export type PresenceMethod = 'gps' | 'qr' | 'nfc' | 'manual';
export type PresenceStatus = 'valid' | 'pending_review' | 'rejected';
export type OccurrenceType = 'furto' | 'acidente' | 'invasao' | 'dano' | 'briga' | 'suspeito' | 'outro' | 'sos';
export type Severity = 'baixa' | 'media' | 'alta' | 'critica';
export type OccurrenceStatus = 'aberta' | 'em_tratamento' | 'resolvida' | 'cancelada';
export type FTRequestStatus = 'aberta' | 'acionando' | 'aceita' | 'resolvida' | 'cancelada';
export type FTReason = 'ausencia' | 'atraso' | 'retencao' | 'preventiva';
export type OperationalStatus = 'coberto' | 'parcialmente_coberto' | 'atencao' | 'descoberto' | 'critico' | 'sos_ativo';
export type AlertType = 'sos' | 'ausencia' | 'atraso' | 'ft_aberta' | 'ocorrencia_critica' | 'ronda_atrasada' | 'retencao' | 'mock_location';
export type AlertChannel = 'push' | 'sms' | 'email' | 'system';
export type AlertStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'acknowledged';
export type RondaStatus = 'pendente' | 'concluida' | 'atrasada' | 'perdida';
export type HandoverStatus = 'pendente' | 'confirmada' | 'retido';
export type RegimeTrabalho = '12x36' | '12x36_noturno' | '24x48' | 'custom';

// --- Database Tables ---
export interface Company {
  id: string;
  name: string;
  cnpj: string;
  logo_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  active: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  company_id: string;
  role: Role;
  name: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  fcm_token?: string;
  ft_available: boolean;
  regime_trabalho: RegimeTrabalho;
  data_referencia_ciclo: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  company_id: string;
  name: string;
  cnpj?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  address?: string;
  active: boolean;
  created_at: string;
}

export interface Post {
  id: string;
  company_id: string;
  client_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radius_meters: number;
  min_staff: number;
  tolerance_minutes: number;
  require_photo: boolean;
  require_ronda: boolean;
  ronda_interval_minutes?: number;
  ronda_tolerance_minutes?: number;
  indoor_mode: boolean;
  qr_code_token: string;
  nfc_uid?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: string;
  company_id: string;
  post_id: string;
  employee_id: string;
  shift_start: string;
  shift_end: string;
  regime: RegimeTrabalho;
  cycle_reference_date: string;
  weekdays?: number[];
  template_id?: string;
  is_active: boolean;
  status: string;
  created_at: string;
}

export interface Presence {
  id: string;
  schedule_id?: string;
  employee_id: string;
  post_id: string;
  confirmed_at: string;
  gps_lat?: number;
  gps_lng?: number;
  gps_valid: boolean;
  accuracy?: number;
  validation_method: PresenceMethod;
  photo_url?: string;
  is_mock_location: boolean;
  status: PresenceStatus;
  offline_created_at?: string;
  synced_at?: string;
  idempotency_key: string;
  created_at: string;
}

export interface Occurrence {
  id: string;
  post_id: string;
  employee_id: string;
  type: OccurrenceType;
  severity: Severity;
  description?: string;
  photo_url?: string;
  gps_lat?: number;
  gps_lng?: number;
  status: OccurrenceStatus;
  ack_supervisor?: string;
  ack_gerente?: string;
  resolved_at?: string;
  resolved_by?: string;
  idempotency_key: string;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export interface FTRequest {
  id: string;
  company_id: string;
  post_id: string;
  schedule_id?: string;
  opened_by: string;
  reason: FTReason;
  urgency: Severity;
  status: FTRequestStatus;
  assigned_to?: string;
  opened_at: string;
  resolved_at?: string;
  notes?: string;
  created_at: string;
}

export interface AlertLog {
  id: string;
  company_id: string;
  type: AlertType;
  target_user_id: string;
  post_id?: string;
  occurrence_id?: string;
  ft_request_id?: string;
  payload?: Record<string, unknown>;
  sent_at: string;
  acknowledged_at?: string;
  escalated: boolean;
  channel: AlertChannel;
  status: AlertStatus;
  created_at: string;
}

export interface LocationTracking {
  id: string;
  employee_id: string;
  post_id?: string;
  lat: number;
  lng: number;
  accuracy?: number;
  is_sos_active: boolean;
  battery_level?: number;
  device_info?: string;
  created_at: string;
}

export interface RondaPoint {
  id: string;
  post_id: string;
  name: string;
  lat: number;
  lng: number;
  radius_meters: number;
  qr_code_token?: string;
  nfc_uid?: string;
  sequence_order: number;
  require_photo: boolean;
  active: boolean;
  created_at: string;
}

export interface RondaLog {
  id: string;
  ronda_point_id: string;
  employee_id: string;
  post_id: string;
  status: RondaStatus;
  confirmed_at?: string;
  gps_lat?: number;
  gps_lng?: number;
  photo_url?: string;
  notes?: string;
  created_at: string;
}

export interface ShiftHandover {
  id: string;
  post_id: string;
  outgoing_employee_id: string;
  incoming_employee_id: string;
  status: HandoverStatus;
  notes?: string;
  pending_items?: string[];
  retention_reason?: string;
  confirmed_at?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  company_id: string;
  actor_id: string;
  action: string;
  entity: string;
  entity_id: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// --- UI / DTO Types ---
export interface OperationalPostStatus {
  post_id: string;
  post_name: string;
  client_name: string;
  status: OperationalStatus;
  min_staff: number;
  confirmed_count: number;
  missing_count: number;
  current_shift_start?: string;
  current_shift_end?: string;
  supervisor_id?: string;
  supervisor_name?: string;
  last_occurrence_at?: string;
  active_sos_count: number;
  employees_present: string[];
  employees_missing: string[];
}

export interface DashboardSummary {
  total_posts: number;
  cobertos: number;
  atencao: number;
  criticos: number;
  descobertos: number;
  sos_ativos: number;
  fts_abertas: number;
  ocorrencias_criticas: number;
}

export interface AlertWithDetails extends AlertLog {
  target_name?: string;
  post_name?: string;
  occurrence_type?: OccurrenceType;
}

export interface GeoCheckResult {
  within_fence: boolean;
  distance_meters: number;
  accuracy_ok: boolean;
  mock_detected: boolean;
  mock_reasons: string[];
}

export interface CheckInInput {
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
  idempotency_key: string;
}

export interface SOSInput {
  post_id: string;
  employee_id: string;
  lat?: number;
  lng?: number;
  idempotency_key: string;
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

// --- Role Display Info ---
export const ROLE_LABELS: Record<Role, string> = {
  operador: 'Operador',
  lider: 'Líder',
  supervisor: 'Supervisor',
  gerente: 'Gerente',
  diretor: 'Diretor',
  admin: 'Administrador',
};

export const STATUS_COLORS: Record<OperationalStatus, string> = {
  coberto: 'bg-green-500',
  parcialmente_coberto: 'bg-blue-500',
  atencao: 'bg-yellow-500',
  descoberto: 'bg-gray-500',
  critico: 'bg-red-500',
  sos_ativo: 'bg-red-700',
};

export const STATUS_LABELS: Record<OperationalStatus, string> = {
  coberto: 'Coberto',
  parcialmente_coberto: 'Parcial',
  atencao: 'Atenção',
  descoberto: 'Descoberto',
  critico: 'Crítico',
  sos_ativo: 'SOS Ativo',
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  baixa: 'bg-blue-100 text-blue-800',
  media: 'bg-yellow-100 text-yellow-800',
  alta: 'bg-orange-100 text-orange-800',
  critica: 'bg-red-100 text-red-800',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export const OCCURRENCE_TYPE_LABELS: Record<OccurrenceType, string> = {
  furto: 'Furto',
  acidente: 'Acidente',
  invasao: 'Invasão',
  dano: 'Dano',
  briga: 'Briga',
  suspeito: 'Suspeito',
  outro: 'Outro',
  sos: 'SOS',
};

export const METHOD_LABELS: Record<PresenceMethod, string> = {
  gps: 'GPS',
  qr: 'QR Code',
  nfc: 'NFC',
  manual: 'Manual',
};
