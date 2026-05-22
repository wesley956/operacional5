// ============================================================
// OPERACIONAL5 — Dados Mock para Demo
// ============================================================
// Estes dados simulam um cenário real de empresa de segurança.
// Em produção, todos os dados vêm do Supabase.

import type {
  Company, Profile, Client, Post, Schedule, Presence,
  Occurrence, FTRequest, AlertLog, OperationalPostStatus,
  DashboardSummary, Role,
} from './types';

// --- IDs Fixos para Demo ---
export const DEMO_COMPANY_ID = 'comp-001';
export const DEMO_IDS = {
  company: 'comp-001',
  client: 'client-001',
  posts: { p1: 'post-001', p2: 'post-002', p3: 'post-003' },
  profiles: {
    gerente: 'prof-001',
    supervisor: 'prof-002',
    lider: 'prof-003',
    operador1: 'prof-004',
    operador2: 'prof-005',
    operador3: 'prof-006',
  },
};

// --- Company ---
export const DEMO_COMPANY: Company = {
  id: DEMO_IDS.company,
  name: 'Segurança Total Proteção Ltda',
  cnpj: '12.345.678/0001-90',
  phone: '(11) 98765-4321',
  email: 'contato@segurancatotal.com.br',
  address: 'Av. Paulista, 1000 - São Paulo, SP',
  active: true,
  created_at: '2024-01-15T08:00:00Z',
};

// --- Client ---
export const DEMO_CLIENT: Client = {
  id: DEMO_IDS.client,
  company_id: DEMO_COMPANY_ID,
  name: 'Edifícios Corporativos Plaza',
  cnpj: '98.765.432/0001-10',
  contact_name: 'Roberto Almeida',
  contact_phone: '(11) 91234-5678',
  contact_email: 'roberto@plaza.com.br',
  address: 'Rua Augusta, 500 - São Paulo, SP',
  active: true,
  created_at: '2024-01-20T10:00:00Z',
};

// --- Profiles ---
export const DEMO_PROFILES: Profile[] = [
  {
    id: DEMO_IDS.profiles.gerente,
    user_id: 'user-gerente',
    company_id: DEMO_COMPANY_ID,
    role: 'gerente',
    name: 'Carlos Mendes',
    email: 'carlos@segurancatotal.com.br',
    phone: '(11) 99876-5432',
    ft_available: false,
    regime_trabalho: '12x36',
    data_referencia_ciclo: '2024-01-01',
    active: true,
    created_at: '2024-01-15T08:00:00Z',
    updated_at: '2024-01-15T08:00:00Z',
  },
  {
    id: DEMO_IDS.profiles.supervisor,
    user_id: 'user-supervisor',
    company_id: DEMO_COMPANY_ID,
    role: 'supervisor',
    name: 'Marcos Oliveira',
    email: 'marcos@segurancatotal.com.br',
    phone: '(11) 98765-1234',
    ft_available: false,
    regime_trabalho: '12x36',
    data_referencia_ciclo: '2024-01-01',
    active: true,
    created_at: '2024-01-15T08:30:00Z',
    updated_at: '2024-01-15T08:30:00Z',
  },
  {
    id: DEMO_IDS.profiles.lider,
    user_id: 'user-lider',
    company_id: DEMO_COMPANY_ID,
    role: 'lider',
    name: 'Ana Santos',
    email: 'ana@segurancatotal.com.br',
    phone: '(11) 97654-3210',
    ft_available: false,
    regime_trabalho: '12x36',
    data_referencia_ciclo: '2024-01-01',
    active: true,
    created_at: '2024-01-16T09:00:00Z',
    updated_at: '2024-01-16T09:00:00Z',
  },
  {
    id: DEMO_IDS.profiles.operador1,
    user_id: 'user-op1',
    company_id: DEMO_COMPANY_ID,
    role: 'operador',
    name: 'João Silva',
    email: 'joao@segurancatotal.com.br',
    phone: '(11) 96543-2109',
    ft_available: false,
    regime_trabalho: '12x36',
    data_referencia_ciclo: '2024-01-01',
    active: true,
    created_at: '2024-01-16T09:30:00Z',
    updated_at: '2024-01-16T09:30:00Z',
  },
  {
    id: DEMO_IDS.profiles.operador2,
    user_id: 'user-op2',
    company_id: DEMO_COMPANY_ID,
    role: 'operador',
    name: 'Pedro Costa',
    email: 'pedro@segurancatotal.com.br',
    phone: '(11) 95432-1098',
    ft_available: false,
    regime_trabalho: '12x36',
    data_referencia_ciclo: '2024-01-02',
    active: true,
    created_at: '2024-01-17T10:00:00Z',
    updated_at: '2024-01-17T10:00:00Z',
  },
  {
    id: DEMO_IDS.profiles.operador3,
    user_id: 'user-op3',
    company_id: DEMO_COMPANY_ID,
    role: 'operador',
    name: 'José Ferreira',
    email: 'jose@segurancatotal.com.br',
    phone: '(11) 94321-0987',
    ft_available: true,
    regime_trabalho: '12x36',
    data_referencia_ciclo: '2024-01-03',
    active: true,
    created_at: '2024-01-18T10:30:00Z',
    updated_at: '2024-01-18T10:30:00Z',
  },
];

// --- Posts ---
export const DEMO_POSTS: Post[] = [
  {
    id: DEMO_IDS.posts.p1,
    company_id: DEMO_COMPANY_ID,
    client_id: DEMO_IDS.client,
    name: 'Portaria Principal - Plaza',
    address: 'Rua Augusta, 500 - Entrada Principal',
    lat: -23.5505,
    lng: -46.6333,
    radius_meters: 50,
    min_staff: 1,
    tolerance_minutes: 15,
    require_photo: true,
    require_ronda: true,
    ronda_interval_minutes: 120,
    ronda_tolerance_minutes: 15,
    indoor_mode: false,
    qr_code_token: 'qr-plaza-principal-2024',
    active: true,
    created_at: '2024-01-20T10:00:00Z',
    updated_at: '2024-01-20T10:00:00Z',
  },
  {
    id: DEMO_IDS.posts.p2,
    company_id: DEMO_COMPANY_ID,
    client_id: DEMO_IDS.client,
    name: 'Estacionamento Subsolo - Plaza',
    address: 'Rua Augusta, 500 - Estacionamento B2',
    lat: -23.5510,
    lng: -46.6340,
    radius_meters: 100,
    min_staff: 1,
    tolerance_minutes: 15,
    require_photo: true,
    require_ronda: true,
    ronda_interval_minutes: 90,
    ronda_tolerance_minutes: 10,
    indoor_mode: true,
    qr_code_token: 'qr-plaza-estacionamento-2024',
    active: true,
    created_at: '2024-01-20T10:30:00Z',
    updated_at: '2024-01-20T10:30:00Z',
  },
  {
    id: DEMO_IDS.posts.p3,
    company_id: DEMO_COMPANY_ID,
    client_id: DEMO_IDS.client,
    name: 'Portaria Torre B - Plaza',
    address: 'Rua Augusta, 520 - Torre B',
    lat: -23.5600,
    lng: -46.6500,
    radius_meters: 75,
    min_staff: 2,
    tolerance_minutes: 15,
    require_photo: true,
    require_ronda: false,
    indoor_mode: false,
    qr_code_token: 'qr-plaza-torreb-2024',
    active: true,
    created_at: '2024-02-01T08:00:00Z',
    updated_at: '2024-02-01T08:00:00Z',
  },
];

// Helper to build today's shift times
function todayShiftStart(): string {
  const d = new Date();
  d.setHours(6, 0, 0, 0);
  return d.toISOString();
}
function todayShiftEnd(): string {
  const d = new Date();
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}
function recentTime(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60000).toISOString();
}

// --- Schedules ---
export const DEMO_SCHEDULES: Schedule[] = [
  {
    id: 'sched-001',
    company_id: DEMO_COMPANY_ID,
    post_id: DEMO_IDS.posts.p1,
    employee_id: DEMO_IDS.profiles.operador1,
    shift_start: todayShiftStart(),
    shift_end: todayShiftEnd(),
    regime: '12x36',
    cycle_reference_date: '2024-01-01',
    is_active: true,
    status: 'active',
    created_at: '2024-01-25T08:00:00Z',
  },
  {
    id: 'sched-002',
    company_id: DEMO_COMPANY_ID,
    post_id: DEMO_IDS.posts.p2,
    employee_id: DEMO_IDS.profiles.operador2,
    shift_start: todayShiftStart(),
    shift_end: todayShiftEnd(),
    regime: '12x36',
    cycle_reference_date: '2024-01-02',
    is_active: true,
    status: 'active',
    created_at: '2024-01-25T08:00:00Z',
  },
  {
    id: 'sched-003',
    company_id: DEMO_COMPANY_ID,
    post_id: DEMO_IDS.posts.p3,
    employee_id: DEMO_IDS.profiles.operador3,
    shift_start: todayShiftStart(),
    shift_end: todayShiftEnd(),
    regime: '12x36',
    cycle_reference_date: '2024-01-03',
    is_active: true,
    status: 'active',
    created_at: '2024-01-25T08:00:00Z',
  },
];

// --- Presences ---
export const DEMO_PRESENCES: Presence[] = [
  {
    id: 'pres-001',
    schedule_id: 'sched-001',
    employee_id: DEMO_IDS.profiles.operador1,
    post_id: DEMO_IDS.posts.p1,
    confirmed_at: recentTime(240),
    gps_lat: -23.5504,
    gps_lng: -46.6332,
    gps_valid: true,
    accuracy: 12,
    validation_method: 'gps',
    photo_url: undefined,
    is_mock_location: false,
    status: 'valid',
    idempotency_key: 'idem-pres-001',
    created_at: recentTime(240),
  },
  {
    id: 'pres-002',
    schedule_id: 'sched-002',
    employee_id: DEMO_IDS.profiles.operador2,
    post_id: DEMO_IDS.posts.p2,
    confirmed_at: recentTime(180),
    gps_lat: -23.5512,
    gps_lng: -46.6345,
    gps_valid: true,
    accuracy: 8,
    validation_method: 'qr',
    photo_url: '/evidence/demo/qr-checkin.jpg',
    is_mock_location: false,
    status: 'valid',
    idempotency_key: 'idem-pres-002',
    created_at: recentTime(180),
  },
];

// --- Occurrences ---
export const DEMO_OCCURRENCES: Occurrence[] = [
  {
    id: 'occ-001',
    post_id: DEMO_IDS.posts.p3,
    employee_id: DEMO_IDS.profiles.operador3,
    type: 'suspeito',
    severity: 'media',
    description: 'Indivíduo suspeito rondando a portaria da Torre B. Usava moletom com capuz e tentou entrar sem crachá.',
    photo_url: '/evidence/demo/suspeito-torreb.jpg',
    status: 'aberta',
    idempotency_key: 'idem-occ-001',
    company_id: DEMO_COMPANY_ID,
    created_at: recentTime(45),
    updated_at: recentTime(45),
  },
  {
    id: 'occ-002',
    post_id: DEMO_IDS.posts.p1,
    employee_id: DEMO_IDS.profiles.operador1,
    type: 'sos',
    severity: 'critica',
    description: 'SOS disparado pelo operador. Agressão verbal por morador no hall de entrada.',
    status: 'aberta',
    idempotency_key: 'idem-occ-002-sos',
    company_id: DEMO_COMPANY_ID,
    created_at: recentTime(10),
    updated_at: recentTime(10),
  },
  {
    id: 'occ-003',
    post_id: DEMO_IDS.posts.p2,
    employee_id: DEMO_IDS.profiles.operador2,
    type: 'dano',
    severity: 'baixa',
    description: 'Câmera de segurança do estacionamento B2 com vidro trincado.',
    photo_url: '/evidence/demo/dano-camera.jpg',
    status: 'em_tratamento',
    ack_supervisor: DEMO_IDS.profiles.supervisor,
    idempotency_key: 'idem-occ-003',
    company_id: DEMO_COMPANY_ID,
    created_at: recentTime(300),
    updated_at: recentTime(280),
  },
];

// --- FT Requests ---
export const DEMO_FT_REQUESTS: FTRequest[] = [
  {
    id: 'ft-001',
    company_id: DEMO_COMPANY_ID,
    post_id: DEMO_IDS.posts.p3,
    opened_by: DEMO_IDS.profiles.supervisor,
    reason: 'ausencia',
    urgency: 'alta',
    status: 'aberta',
    opened_at: recentTime(35),
    notes: 'Operador escalado não compareceu. Torre B com 0 de 2 vigilantes.',
    created_at: recentTime(35),
  },
];

// --- Alert Logs ---
export const DEMO_ALERTS: AlertLog[] = [
  {
    id: 'alert-001',
    company_id: DEMO_COMPANY_ID,
    type: 'sos',
    target_user_id: DEMO_IDS.profiles.supervisor,
    post_id: DEMO_IDS.posts.p1,
    occurrence_id: 'occ-002',
    payload: { message: 'SOS disparado por João Silva na Portaria Principal' },
    sent_at: recentTime(10),
    escalated: false,
    channel: 'system',
    status: 'sent',
    created_at: recentTime(10),
  },
  {
    id: 'alert-002',
    company_id: DEMO_COMPANY_ID,
    type: 'ausencia',
    target_user_id: DEMO_IDS.profiles.supervisor,
    post_id: DEMO_IDS.posts.p3,
    payload: { message: 'Torre B sem vigilante após tolerância de 15min' },
    sent_at: recentTime(35),
    escalated: false,
    channel: 'system',
    status: 'sent',
    created_at: recentTime(35),
  },
  {
    id: 'alert-003',
    company_id: DEMO_COMPANY_ID,
    type: 'ocorrencia_critica',
    target_user_id: DEMO_IDS.profiles.gerente,
    post_id: DEMO_IDS.posts.p1,
    occurrence_id: 'occ-002',
    payload: { message: 'SOS ativo na Portaria Principal - Plaza' },
    sent_at: recentTime(10),
    escalated: true,
    channel: 'system',
    status: 'sent',
    created_at: recentTime(10),
  },
  {
    id: 'alert-004',
    company_id: DEMO_COMPANY_ID,
    type: 'ft_aberta',
    target_user_id: DEMO_IDS.profiles.gerente,
    post_id: DEMO_IDS.posts.p3,
    ft_request_id: 'ft-001',
    payload: { message: 'FT aberta para Torre B - motivo: ausência' },
    sent_at: recentTime(30),
    escalated: false,
    channel: 'system',
    status: 'sent',
    created_at: recentTime(30),
  },
];

// --- Operational Status ---
export const DEMO_POST_STATUS: OperationalPostStatus[] = [
  {
    post_id: DEMO_IDS.posts.p1,
    post_name: 'Portaria Principal - Plaza',
    client_name: 'Edifícios Corporativos Plaza',
    status: 'sos_ativo',
    min_staff: 1,
    confirmed_count: 1,
    missing_count: 0,
    current_shift_start: todayShiftStart(),
    current_shift_end: todayShiftEnd(),
    supervisor_id: DEMO_IDS.profiles.supervisor,
    supervisor_name: 'Marcos Oliveira',
    last_occurrence_at: recentTime(10),
    active_sos_count: 1,
    employees_present: ['João Silva'],
    employees_missing: [],
  },
  {
    post_id: DEMO_IDS.posts.p2,
    post_name: 'Estacionamento Subsolo - Plaza',
    client_name: 'Edifícios Corporativos Plaza',
    status: 'coberto',
    min_staff: 1,
    confirmed_count: 1,
    missing_count: 0,
    current_shift_start: todayShiftStart(),
    current_shift_end: todayShiftEnd(),
    supervisor_id: DEMO_IDS.profiles.supervisor,
    supervisor_name: 'Marcos Oliveira',
    active_sos_count: 0,
    employees_present: ['Pedro Costa'],
    employees_missing: [],
  },
  {
    post_id: DEMO_IDS.posts.p3,
    post_name: 'Portaria Torre B - Plaza',
    client_name: 'Edifícios Corporativos Plaza',
    status: 'critico',
    min_staff: 2,
    confirmed_count: 0,
    missing_count: 2,
    current_shift_start: todayShiftStart(),
    current_shift_end: todayShiftEnd(),
    supervisor_id: DEMO_IDS.profiles.supervisor,
    supervisor_name: 'Marcos Oliveira',
    last_occurrence_at: recentTime(45),
    active_sos_count: 0,
    employees_present: [],
    employees_missing: ['José Ferreira', '(vaga)'],
  },
];

// --- Dashboard Summary ---
export const DEMO_DASHBOARD: DashboardSummary = {
  total_posts: 3,
  cobertos: 1,
  atencao: 0,
  criticos: 1,
  descobertos: 0,
  sos_ativos: 1,
  fts_abertas: 1,
  ocorrencias_criticas: 1,
};

// --- Demo Login ---
export interface DemoUser {
  profile: Profile;
  password: string;
}

export const DEMO_USERS: { label: string; role: Role; profile: Profile }[] = [
  { label: 'Carlos Mendes', role: 'gerente', profile: DEMO_PROFILES[0] },
  { label: 'Marcos Oliveira', role: 'supervisor', profile: DEMO_PROFILES[1] },
  { label: 'Ana Santos', role: 'lider', profile: DEMO_PROFILES[2] },
  { label: 'João Silva', role: 'operador', profile: DEMO_PROFILES[3] },
];

// ============================================================
// FASE 2 — Rondas, Passagem de Plantão, Notificações, Relatórios
// ============================================================

// --- Ronda Points ---
export interface RondaPoint {
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

export interface RondaLog {
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

export const DEMO_RONDA_POINTS: RondaPoint[] = [
  { id: 'rp-001', post_id: DEMO_IDS.posts.p1, name: 'Hall Principal', lat: -23.5503, lng: -46.6332, radius_meters: 20, sequence_order: 1, require_photo: false, qr_code_token: 'ronda-hall-001', active: true },
  { id: 'rp-002', post_id: DEMO_IDS.posts.p1, name: 'Elevadores Bloco A', lat: -23.5506, lng: -46.6335, radius_meters: 20, sequence_order: 2, require_photo: false, qr_code_token: 'ronda-elev-001', active: true },
  { id: 'rp-003', post_id: DEMO_IDS.posts.p1, name: 'Garagem Nível 1', lat: -23.5508, lng: -46.6330, radius_meters: 20, sequence_order: 3, require_photo: true, qr_code_token: 'ronda-garagem-001', active: true },
  { id: 'rp-004', post_id: DEMO_IDS.posts.p2, name: 'Entrada Estacionamento', lat: -23.5509, lng: -46.6342, radius_meters: 30, sequence_order: 1, require_photo: false, qr_code_token: 'ronda-est-001', active: true },
  { id: 'rp-005', post_id: DEMO_IDS.posts.p2, name: 'Setor B2 Central', lat: -23.5511, lng: -46.6344, radius_meters: 30, sequence_order: 2, require_photo: true, qr_code_token: 'ronda-b2-001', active: true },
  { id: 'rp-006', post_id: DEMO_IDS.posts.p2, name: 'Saída de Emergência', lat: -23.5512, lng: -46.6338, radius_meters: 20, sequence_order: 3, require_photo: false, qr_code_token: 'ronda-emer-001', active: true },
];

export const DEMO_RONDA_LOGS: RondaLog[] = [
  { id: 'rl-001', ronda_point_id: 'rp-001', employee_id: DEMO_IDS.profiles.operador1, post_id: DEMO_IDS.posts.p1, status: 'concluida', confirmed_at: recentTime(120), gps_lat: -23.5503, gps_lng: -46.6332, created_at: recentTime(120) },
  { id: 'rl-002', ronda_point_id: 'rp-002', employee_id: DEMO_IDS.profiles.operador1, post_id: DEMO_IDS.posts.p1, status: 'concluida', confirmed_at: recentTime(115), gps_lat: -23.5506, gps_lng: -46.6335, created_at: recentTime(115) },
  { id: 'rl-003', ronda_point_id: 'rp-003', employee_id: DEMO_IDS.profiles.operador1, post_id: DEMO_IDS.posts.p1, status: 'pendente', created_at: recentTime(100) },
  { id: 'rl-004', ronda_point_id: 'rp-004', employee_id: DEMO_IDS.profiles.operador2, post_id: DEMO_IDS.posts.p2, status: 'concluida', confirmed_at: recentTime(90), gps_lat: -23.5509, gps_lng: -46.6342, created_at: recentTime(90) },
  { id: 'rl-005', ronda_point_id: 'rp-005', employee_id: DEMO_IDS.profiles.operador2, post_id: DEMO_IDS.posts.p2, status: 'atrasada', created_at: recentTime(60) },
  { id: 'rl-006', ronda_point_id: 'rp-006', employee_id: DEMO_IDS.profiles.operador2, post_id: DEMO_IDS.posts.p2, status: 'pendente', created_at: recentTime(50) },
];

// --- Shift Handovers ---
export interface ShiftHandover {
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

export const DEMO_HANDOVERS: ShiftHandover[] = [
  {
    id: 'sh-001', post_id: DEMO_IDS.posts.p1,
    outgoing_employee_id: DEMO_IDS.profiles.operador1,
    incoming_employee_id: DEMO_IDS.profiles.operador3,
    status: 'confirmada',
    notes: 'Turno tranquilo. Entrega de correspondência pendente no balcão.',
    pending_items: ['Correspondência apto 302', 'Lâmpada hall 3º andar queimada'],
    confirmed_at: recentTime(60),
    created_at: recentTime(65),
  },
  {
    id: 'sh-002', post_id: DEMO_IDS.posts.p2,
    outgoing_employee_id: DEMO_IDS.profiles.operador2,
    incoming_employee_id: DEMO_IDS.profiles.operador3,
    status: 'retido',
    notes: 'Próximo vigilante não compareceu. Operador atual retido além do turno.',
    pending_items: ['Solicitar FT urgente', 'Câmera B2 offline'],
    retention_reason: 'ausencia_substituto',
    created_at: recentTime(10),
  },
  {
    id: 'sh-003', post_id: DEMO_IDS.posts.p3,
    outgoing_employee_id: DEMO_IDS.profiles.operador3,
    incoming_employee_id: DEMO_IDS.profiles.operador1,
    status: 'pendente',
    pending_items: [],
    created_at: recentTime(5),
  },
];

// --- Notifications (extended) ---
export interface Notification {
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

export const DEMO_NOTIFICATIONS: Notification[] = [
  { id: 'n-001', type: 'sos', title: '🚨 SOS Disparado', message: 'João Silva disparou SOS na Portaria Principal — Agressão verbal por morador.', severity: 'critical', post_name: 'Portaria Principal - Plaza', employee_name: 'João Silva', is_read: false, created_at: recentTime(10), action_url: '/occurrences' },
  { id: 'n-002', type: 'absence', title: '⚠️ Ausência Detectada', message: 'Torre B sem vigilante após tolerância de 15 minutos. Mínimo: 2, Presentes: 0.', severity: 'danger', post_name: 'Portaria Torre B - Plaza', is_read: false, created_at: recentTime(35), action_url: '/ft' },
  { id: 'n-003', type: 'ft', title: '🔵 FT Aberta', message: 'FT aberta para Portaria Torre B — Motivo: ausência. Urgência: alta.', severity: 'warning', post_name: 'Portaria Torre B - Plaza', is_read: false, created_at: recentTime(30), action_url: '/ft' },
  { id: 'n-004', type: 'occurrence', title: '📋 Ocorrência Crítica', message: 'Ocorrência tipo SOS registrada na Portaria Principal — Severidade crítica.', severity: 'critical', post_name: 'Portaria Principal - Plaza', employee_name: 'João Silva', is_read: false, created_at: recentTime(10), action_url: '/occurrences' },
  { id: 'n-005', type: 'ronda', title: '🔍 Ronda Atrasada', message: 'Ronda no ponto "Setor B2 Central" está atrasada há mais de 30 minutos.', severity: 'warning', post_name: 'Estacionamento Subsolo - Plaza', employee_name: 'Pedro Costa', is_read: true, created_at: recentTime(60), action_url: '/rondas' },
  { id: 'n-006', type: 'handover', title: '🔄 Retenção Involuntária', message: 'Pedro Costa retido no Estacionamento Subsolo — substituto não compareceu.', severity: 'danger', post_name: 'Estacionamento Subsolo - Plaza', employee_name: 'Pedro Costa', is_read: false, created_at: recentTime(10), action_url: '/handovers' },
  { id: 'n-007', type: 'system', title: '✅ Check-in Confirmado', message: 'João Silva confirmou presença na Portaria Principal via GPS (12m de distância).', severity: 'info', post_name: 'Portaria Principal - Plaza', employee_name: 'João Silva', is_read: true, created_at: recentTime(240), action_url: '/presence' },
  { id: 'n-008', type: 'system', title: '✅ Check-in QR', message: 'Pedro Costa confirmou presença no Estacionamento Subsolo via QR Code com foto.', severity: 'info', post_name: 'Estacionamento Subsolo - Plaza', employee_name: 'Pedro Costa', is_read: true, created_at: recentTime(180), action_url: '/presence' },
  { id: 'n-009', type: 'escalation', title: '⬆️ Escalonamento', message: 'SOS da Portaria Principal escalado para gerente — sem ciência em 10 minutos.', severity: 'critical', post_name: 'Portaria Principal - Plaza', is_read: false, created_at: recentTime(8) },
  { id: 'n-010', type: 'schedule', title: '📅 Escala Atualizada', message: 'Escala de José Ferreira atualizada para Torre B — turno 06:00 às 18:00.', severity: 'info', employee_name: 'José Ferreira', is_read: true, created_at: recentTime(360) },
];

// --- Reports Data ---
export interface ReportData {
  id: string;
  type: 'daily' | 'weekly' | 'monthly' | 'incident';
  title: string;
  date: string;
  generated_at: string;
  posts_covered: number;
  posts_total: number;
  occurrences_count: number;
  critical_occurrences: number;
  fts_opened: number;
  fts_resolved: number;
  sos_count: number;
  avg_response_time_min: number;
  presence_rate: number;
  ronda_completion: number;
}

export const DEMO_REPORTS: ReportData[] = [
  {
    id: 'rep-001', type: 'daily', title: 'Relatório Diário — Hoje', date: new Date().toISOString().split('T')[0],
    generated_at: recentTime(30), posts_covered: 2, posts_total: 3,
    occurrences_count: 3, critical_occurrences: 1, fts_opened: 1, fts_resolved: 0,
    sos_count: 1, avg_response_time_min: 4.5, presence_rate: 66.7, ronda_completion: 50,
  },
  {
    id: 'rep-002', type: 'daily', title: 'Relatório Diário — Ontem',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    generated_at: recentTime(1440), posts_covered: 3, posts_total: 3,
    occurrences_count: 1, critical_occurrences: 0, fts_opened: 0, fts_resolved: 0,
    sos_count: 0, avg_response_time_min: 0, presence_rate: 100, ronda_completion: 95,
  },
  {
    id: 'rep-003', type: 'weekly', title: 'Relatório Semanal',
    date: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
    generated_at: recentTime(10080), posts_covered: 20, posts_total: 21,
    occurrences_count: 8, critical_occurrences: 1, fts_opened: 3, fts_resolved: 2,
    sos_count: 1, avg_response_time_min: 6.2, presence_rate: 95.2, ronda_completion: 88,
  },
  {
    id: 'rep-004', type: 'monthly', title: 'Relatório Mensal — Janeiro',
    date: '2024-01-01', generated_at: recentTime(43200),
    posts_covered: 85, posts_total: 90, occurrences_count: 24, critical_occurrences: 2,
    fts_opened: 8, fts_resolved: 7, sos_count: 2, avg_response_time_min: 5.8,
    presence_rate: 94.4, ronda_completion: 91,
  },
];

// --- FT Automation Log ---
export interface FTAutoAction {
  id: string;
  type: 'scan_absence' | 'auto_ft' | 'escalate' | 'notify';
  post_id?: string;
  post_name?: string;
  employee_id?: string;
  employee_name?: string;
  description: string;
  timestamp: string;
  automated: boolean;
}

export const DEMO_FT_AUTO_ACTIONS: FTAutoAction[] = [
  { id: 'fta-001', type: 'scan_absence', post_id: DEMO_IDS.posts.p3, post_name: 'Portaria Torre B - Plaza', description: 'Ausência detectada: José Ferreira não confirmou presença após 15min de tolerância.', timestamp: recentTime(35), automated: true },
  { id: 'fta-002', type: 'auto_ft', post_id: DEMO_IDS.posts.p3, post_name: 'Portaria Torre B - Plaza', description: 'FT automática aberta para Torre B — urgência alta. 0 de 2 vigilantes.', timestamp: recentTime(34), automated: true },
  { id: 'fta-003', type: 'notify', post_id: DEMO_IDS.posts.p3, post_name: 'Portaria Torre B - Plaza', description: 'Supervisor Marcos Oliveira notificado via sistema.', timestamp: recentTime(34), automated: true },
  { id: 'fta-004', type: 'escalate', post_id: DEMO_IDS.posts.p3, post_name: 'Portaria Torre B - Plaza', description: 'Alerta escalado para Gerente Carlos Mendes — FT sem resposta há 30min.', timestamp: recentTime(5), automated: true },
  { id: 'fta-005', type: 'scan_absence', post_id: DEMO_IDS.posts.p1, post_name: 'Portaria Principal - Plaza', employee_id: DEMO_IDS.profiles.operador1, employee_name: 'João Silva', description: 'Presença confirmada via GPS dentro do raio — 12m de distância.', timestamp: recentTime(240), automated: true },
];

// --- Client Portal Data ---
export interface ClientPortalData {
  client_name: string;
  total_posts: number;
  active_posts: number;
  current_shift_coverage: number;
  occurrences_today: number;
  pending_items: number;
  posts: {
    name: string;
    status: string;
    vigilantes: number;
    min_staff: number;
    last_incident?: string;
  }[];
}

export const DEMO_CLIENT_PORTAL: ClientPortalData = {
  client_name: 'Edifícios Corporativos Plaza',
  total_posts: 3,
  active_posts: 3,
  current_shift_coverage: 66.7,
  occurrences_today: 3,
  pending_items: 2,
  posts: [
    { name: 'Portaria Principal', status: 'SOS Ativo', vigilantes: 1, min_staff: 1, last_incident: recentTime(10) },
    { name: 'Estacionamento Subsolo', status: 'Coberto', vigilantes: 1, min_staff: 1 },
    { name: 'Portaria Torre B', status: 'Crítico', vigilantes: 0, min_staff: 2, last_incident: recentTime(45) },
  ],
};

// --- Helper ---
export function getProfileName(profileId: string): string {
  const p = DEMO_PROFILES.find(p => p.id === profileId);
  return p?.name ?? 'Desconhecido';
}

export function getPostName(postId: string): string {
  const p = DEMO_POSTS.find(p => p.id === postId);
  return p?.name ?? 'Posto desconhecido';
}

export function getRondaPointName(pointId: string): string {
  const p = DEMO_RONDA_POINTS.find(p => p.id === pointId);
  return p?.name ?? 'Ponto desconhecido';
}
