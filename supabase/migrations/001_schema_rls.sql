-- ============================================================
-- OPERACIONAL5 — Migration 001: Schema Completo
-- Banco de dados para gestão de segurança privada
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis" CASCADE; -- Opcional, para geo queries avançadas

-- ============================================================
-- TABELAS BASE
-- ============================================================

-- Empresas (multi-tenant root)
CREATE TABLE IF NOT EXISTS companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  logo_url TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  tolerance_minutes INTEGER DEFAULT 15,
  default_gps_radius INTEGER DEFAULT 50,
  min_gps_accuracy INTEGER DEFAULT 50,
  require_photo BOOLEAN DEFAULT true,
  detect_mock_location BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Perfis de Usuário
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_id UUID REFERENCES companies(id) NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('operador','lider','supervisor','gerente','diretor','admin')),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  fcm_token TEXT,
  ft_available BOOLEAN DEFAULT false,
  regime_trabalho TEXT DEFAULT '12x36' CHECK (regime_trabalho IN ('12x36','12x36_noturno','24x48','custom')),
  data_referencia_ciclo DATE DEFAULT '2024-01-01',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Clientes
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) NOT NULL,
  name TEXT NOT NULL,
  cnpj TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  address TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Postos de Serviço
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) NOT NULL,
  client_id UUID REFERENCES clients(id) NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER DEFAULT 50,
  min_staff INTEGER DEFAULT 1 CHECK (min_staff >= 1),
  tolerance_minutes INTEGER DEFAULT 15,
  require_photo BOOLEAN DEFAULT true,
  require_ronda BOOLEAN DEFAULT false,
  ronda_interval_minutes INTEGER DEFAULT 120,
  ronda_tolerance_minutes INTEGER DEFAULT 15,
  indoor_mode BOOLEAN DEFAULT false,
  qr_code_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  nfc_uid TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Escalas
CREATE TABLE IF NOT EXISTS schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) NOT NULL,
  post_id UUID REFERENCES posts(id) NOT NULL,
  employee_id UUID REFERENCES profiles(id) NOT NULL,
  shift_start TIMESTAMPTZ NOT NULL,
  shift_end TIMESTAMPTZ NOT NULL,
  regime TEXT DEFAULT '12x36' CHECK (regime IN ('12x36','12x36_noturno','24x48','custom')),
  cycle_reference_date DATE,
  weekdays INTEGER[],
  template_id UUID,
  is_active BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','cancelled','completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Presenças (check-in)
CREATE TABLE IF NOT EXISTS presences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID REFERENCES schedules(id),
  employee_id UUID REFERENCES profiles(id) NOT NULL,
  post_id UUID REFERENCES posts(id) NOT NULL,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  gps_valid BOOLEAN DEFAULT false,
  accuracy DOUBLE PRECISION,
  validation_method TEXT NOT NULL CHECK (validation_method IN ('gps','qr','nfc','manual')),
  photo_url TEXT,
  is_mock_location BOOLEAN DEFAULT false,
  mock_reasons TEXT[],
  status TEXT DEFAULT 'valid' CHECK (status IN ('valid','pending_review','rejected')),
  offline_created_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  device_info JSONB,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ocorrências
CREATE TABLE IF NOT EXISTS occurrences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) NOT NULL,
  post_id UUID REFERENCES posts(id) NOT NULL,
  employee_id UUID REFERENCES profiles(id) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('furto','acidente','invasao','dano','briga','suspeito','outro','sos')),
  severity TEXT NOT NULL CHECK (severity IN ('baixa','media','alta','critica')),
  description TEXT,
  photo_url TEXT,
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  status TEXT DEFAULT 'aberta' CHECK (status IN ('aberta','em_tratamento','resolvida','cancelada')),
  ack_supervisor UUID REFERENCES profiles(id),
  ack_gerente UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Força Tarefa (FT)
CREATE TABLE IF NOT EXISTS ft_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) NOT NULL,
  post_id UUID REFERENCES posts(id) NOT NULL,
  schedule_id UUID REFERENCES schedules(id),
  opened_by UUID REFERENCES profiles(id) NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('ausencia','atraso','retencao','preventiva')),
  urgency TEXT DEFAULT 'alta' CHECK (urgency IN ('baixa','media','alta','critica')),
  status TEXT DEFAULT 'aberta' CHECK (status IN ('aberta','acionando','aceita','resolvida','cancelada')),
  assigned_to UUID REFERENCES profiles(id),
  opened_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Log de Alertas
CREATE TABLE IF NOT EXISTS alert_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sos','ausencia','atraso','ft_aberta','ocorrencia_critica','ronda_atrasada','retencao','mock_location')),
  target_user_id UUID REFERENCES profiles(id) NOT NULL,
  post_id UUID REFERENCES posts(id),
  occurrence_id UUID REFERENCES occurrences(id),
  ft_request_id UUID REFERENCES ft_requests(id),
  payload JSONB,
  sent_at TIMESTAMPTZ DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  escalated BOOLEAN DEFAULT false,
  channel TEXT DEFAULT 'system' CHECK (channel IN ('push','sms','email','system')),
  status TEXT DEFAULT 'sent' CHECK (status IN ('pending','sent','delivered','failed','acknowledged')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Rastreamento de Localização
CREATE TABLE IF NOT EXISTS location_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES profiles(id) NOT NULL,
  post_id UUID REFERENCES posts(id),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  is_sos_active BOOLEAN DEFAULT false,
  battery_level INTEGER,
  device_info JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pontos de Ronda
CREATE TABLE IF NOT EXISTS ronda_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) NOT NULL,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER DEFAULT 20,
  qr_code_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  nfc_uid TEXT,
  sequence_order INTEGER DEFAULT 0,
  require_photo BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Logs de Ronda
CREATE TABLE IF NOT EXISTS ronda_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ronda_point_id UUID REFERENCES ronda_points(id) NOT NULL,
  employee_id UUID REFERENCES profiles(id) NOT NULL,
  post_id UUID REFERENCES posts(id) NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','concluida','atrasada','perdida')),
  confirmed_at TIMESTAMPTZ,
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  photo_url TEXT,
  notes TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Passagem de Plantão
CREATE TABLE IF NOT EXISTS shift_handovers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) NOT NULL,
  outgoing_employee_id UUID REFERENCES profiles(id) NOT NULL,
  incoming_employee_id UUID REFERENCES profiles(id) NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','confirmada','retido')),
  notes TEXT,
  pending_items TEXT[],
  retention_reason TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Log de Auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) NOT NULL,
  actor_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Atribuição de Supervisores a Postos
CREATE TABLE IF NOT EXISTS supervisor_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supervisor_id UUID REFERENCES profiles(id) NOT NULL,
  post_id UUID REFERENCES posts(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(supervisor_id, post_id)
);

-- Atribuição de Líderes a Postos
CREATE TABLE IF NOT EXISTS leader_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  leader_id UUID REFERENCES profiles(id) NOT NULL,
  post_id UUID REFERENCES posts(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(leader_id, post_id)
);

-- Atribuição de Equipe a Postos
CREATE TABLE IF NOT EXISTS post_team_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) NOT NULL,
  employee_id UUID REFERENCES profiles(id) NOT NULL,
  role_at_post TEXT DEFAULT 'vigilante',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, employee_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX idx_profiles_company_id ON profiles(company_id);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_ft_available ON profiles(ft_available) WHERE ft_available = true AND active = true;

CREATE INDEX idx_clients_company_id ON clients(company_id);

CREATE INDEX idx_posts_company_id ON posts(company_id);
CREATE INDEX idx_posts_client_id ON posts(client_id);
CREATE INDEX idx_posts_qr_code_token ON posts(qr_code_token);
CREATE INDEX idx_posts_active ON posts(active);

CREATE INDEX idx_schedules_company_id ON schedules(company_id);
CREATE INDEX idx_schedules_post_id ON schedules(post_id);
CREATE INDEX idx_schedules_employee_id ON schedules(employee_id);
CREATE INDEX idx_schedules_active ON schedules(is_active) WHERE is_active = true;

CREATE INDEX idx_presences_employee_id ON presences(employee_id);
CREATE INDEX idx_presences_post_id ON presences(post_id);
CREATE INDEX idx_presences_schedule_id ON presences(schedule_id);
CREATE INDEX idx_presences_idempotency ON presences(idempotency_key);
CREATE INDEX idx_presences_confirmed_at ON presences(confirmed_at);
CREATE INDEX idx_presences_status ON presences(status);

CREATE INDEX idx_occurrences_company_id ON occurrences(company_id);
CREATE INDEX idx_occurrences_post_id ON occurrences(post_id);
CREATE INDEX idx_occurrences_employee_id ON occurrences(employee_id);
CREATE INDEX idx_occurrences_status ON occurrences(status);
CREATE INDEX idx_occurrences_severity ON occurrences(severity);
CREATE INDEX idx_occurrences_idempotency ON occurrences(idempotency_key);

CREATE INDEX idx_ft_requests_company_id ON ft_requests(company_id);
CREATE INDEX idx_ft_requests_post_id ON ft_requests(post_id);
CREATE INDEX idx_ft_requests_status ON ft_requests(status);
CREATE INDEX idx_ft_requests_assigned_to ON ft_requests(assigned_to);

CREATE INDEX idx_alert_log_company_id ON alert_log(company_id);
CREATE INDEX idx_alert_log_target_user ON alert_log(target_user_id);
CREATE INDEX idx_alert_log_type ON alert_log(type);
CREATE INDEX idx_alert_log_acknowledged ON alert_log(acknowledged_at) WHERE acknowledged_at IS NULL;

CREATE INDEX idx_location_tracking_employee ON location_tracking(employee_id);
CREATE INDEX idx_location_tracking_sos ON location_tracking(is_sos_active) WHERE is_sos_active = true;

CREATE INDEX idx_ronda_logs_post_id ON ronda_logs(post_id);
CREATE INDEX idx_ronda_logs_employee_id ON ronda_logs(employee_id);

CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Retorna o profile do usuário autenticado
CREATE OR REPLACE FUNCTION current_profile()
RETURNS profiles AS $$
  SELECT * FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Retorna o company_id do usuário autenticado
CREATE OR REPLACE FUNCTION current_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Verifica se o usuário tem determinado role
CREATE OR REPLACE FUNCTION has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND role = required_role AND active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Verifica se o usuário tem qualquer um dos roles especificados
CREATE OR REPLACE FUNCTION has_any_role(required_roles TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND role = ANY(required_roles) AND active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Verifica se o usuário pode acessar um posto específico
CREATE OR REPLACE FUNCTION can_access_post(target_post_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  p RECORD;
BEGIN
  p := current_profile();
  -- Gerente, Diretor e Admin acessam todos os postos da empresa
  IF p.role IN ('gerente','diretor','admin') THEN RETURN true; END IF;
  -- Supervisor acessa postos atribuídos
  IF p.role = 'supervisor' THEN
    RETURN EXISTS (SELECT 1 FROM supervisor_posts WHERE supervisor_id = p.id AND post_id = target_post_id);
  END IF;
  -- Líder acessa posto próprio
  IF p.role = 'lider' THEN
    RETURN EXISTS (SELECT 1 FROM leader_posts WHERE leader_id = p.id AND post_id = target_post_id);
  END IF;
  -- Operador acessa posto do turno atual
  IF p.role = 'operador' THEN
    RETURN EXISTS (
      SELECT 1 FROM schedules s
      WHERE s.employee_id = p.id AND s.post_id = target_post_id
      AND s.is_active = true
      AND now() BETWEEN s.shift_start AND s.shift_end
    );
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Haversine distance em SQL
CREATE OR REPLACE FUNCTION haversine_distance(
  lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION AS $$
  SELECT (6371000 * acos(
    least(1, cos(radians(lat1)) * cos(radians(lat2)) *
    cos(radians(lng2) - radians(lng1)) +
    sin(radians(lat1)) * sin(radians(lat2)))
  ));
$$ LANGUAGE sql IMMUTABLE STRICT;

-- ============================================================
-- HELPER: write_audit
-- ============================================================

CREATE OR REPLACE FUNCTION write_audit(
  p_company_id UUID,
  p_actor_id UUID,
  p_action TEXT,
  p_entity TEXT,
  p_entity_id TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO audit_logs (company_id, actor_id, action, entity, entity_id, metadata)
  VALUES (p_company_id, p_actor_id, p_action, p_entity, p_entity_id, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE presences ENABLE ROW LEVEL SECURITY;
ALTER TABLE occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE ft_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE ronda_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE ronda_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisor_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leader_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_team_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Companies: ver própria empresa
CREATE POLICY "companies_read_own" ON companies FOR SELECT
  USING (id = current_company_id());

-- Profiles: ver perfis da mesma empresa
CREATE POLICY "profiles_read_company" ON profiles FOR SELECT
  USING (company_id = current_company_id());
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  WITH CHECK (company_id = current_company_id() AND has_any_role(ARRAY['admin','gerente']));
CREATE POLICY "profiles_update_own_or_admin" ON profiles FOR UPDATE
  USING (
    (user_id = auth.uid()) OR has_any_role(ARRAY['admin','gerente'])
  );

-- Clients: CRUD pela empresa
CREATE POLICY "clients_read_company" ON clients FOR SELECT
  USING (company_id = current_company_id());
CREATE POLICY "clients_insert_company" ON clients FOR INSERT
  WITH CHECK (company_id = current_company_id() AND has_any_role(ARRAY['admin','gerente']));
CREATE POLICY "clients_update_company" ON clients FOR UPDATE
  USING (company_id = current_company_id() AND has_any_role(ARRAY['admin','gerente']));

-- Posts: ver postos acessíveis
CREATE POLICY "posts_read_accessible" ON posts FOR SELECT
  USING (company_id = current_company_id());
CREATE POLICY "posts_insert_company" ON posts FOR INSERT
  WITH CHECK (company_id = current_company_id() AND has_any_role(ARRAY['admin','gerente']));
CREATE POLICY "posts_update_company" ON posts FOR UPDATE
  USING (company_id = current_company_id() AND has_any_role(ARRAY['admin','gerente']));

-- Schedules: ver da empresa, gerenciar por gerente+
CREATE POLICY "schedules_read_company" ON schedules FOR SELECT
  USING (company_id = current_company_id());
CREATE POLICY "schedules_manage" ON schedules FOR ALL
  USING (company_id = current_company_id() AND has_any_role(ARRAY['admin','gerente']));

-- Presences: operador vê própria, supervisor+ vê do posto
CREATE POLICY "presences_read" ON presences FOR SELECT
  USING (
    employee_id = (SELECT id FROM current_profile())
    OR has_any_role(ARRAY['lider','supervisor','gerente','diretor','admin'])
  );
CREATE POLICY "presences_insert" ON presences FOR INSERT
  WITH CHECK (
    employee_id = (SELECT id FROM current_profile())
    OR has_any_role(ARRAY['admin','gerente'])
  );

-- Occurrences: operador cria/vê próprias, supervisor+ gerencia
CREATE POLICY "occurrences_read" ON occurrences FOR SELECT
  USING (
    company_id = current_company_id() AND (
      employee_id = (SELECT id FROM current_profile())
      OR has_any_role(ARRAY['lider','supervisor','gerente','diretor','admin'])
    )
  );
CREATE POLICY "occurrences_insert" ON occurrences FOR INSERT
  WITH CHECK (
    company_id = current_company_id() AND (
      employee_id = (SELECT id FROM current_profile())
      OR has_any_role(ARRAY['admin','gerente'])
    )
  );
CREATE POLICY "occurrences_update" ON occurrences FOR UPDATE
  USING (
    company_id = current_company_id() AND has_any_role(ARRAY['supervisor','gerente','diretor','admin'])
  );

-- FT Requests: supervisor+ gerencia
CREATE POLICY "ft_requests_read" ON ft_requests FOR SELECT
  USING (company_id = current_company_id());
CREATE POLICY "ft_requests_manage" ON ft_requests FOR ALL
  USING (
    company_id = current_company_id() AND has_any_role(ARRAY['supervisor','gerente','diretor','admin'])
  );

-- Alert Log: supervisor+ visualiza
CREATE POLICY "alert_log_read" ON alert_log FOR SELECT
  USING (
    company_id = current_company_id() AND (
      target_user_id = (SELECT id FROM current_profile())
      OR has_any_role(ARRAY['supervisor','gerente','diretor','admin'])
    )
  );
CREATE POLICY "alert_log_insert" ON alert_log FOR INSERT
  WITH CHECK (company_id = current_company_id());
CREATE POLICY "alert_log_update" ON alert_log FOR UPDATE
  USING (company_id = current_company_id() AND has_any_role(ARRAY['supervisor','gerente','diretor','admin']));

-- Location Tracking: operador insere própria, supervisor+ vê do posto
CREATE POLICY "location_tracking_insert" ON location_tracking FOR INSERT
  WITH CHECK (employee_id = (SELECT id FROM current_profile()));
CREATE POLICY "location_tracking_read" ON location_tracking FOR SELECT
  USING (
    employee_id = (SELECT id FROM current_profile())
    OR has_any_role(ARRAY['supervisor','gerente','diretor','admin'])
  );

-- Ronda Points: ver do posto
CREATE POLICY "ronda_points_read" ON ronda_points FOR SELECT
  USING (post_id IN (SELECT id FROM posts WHERE company_id = current_company_id()));
CREATE POLICY "ronda_points_manage" ON ronda_points FOR ALL
  USING (has_any_role(ARRAY['admin','gerente']));

-- Ronda Logs: operador cria, supervisor+ vê
CREATE POLICY "ronda_logs_read" ON ronda_logs FOR SELECT
  USING (post_id IN (SELECT id FROM posts WHERE company_id = current_company_id()));
CREATE POLICY "ronda_logs_insert" ON ronda_logs FOR INSERT
  WITH CHECK (employee_id = (SELECT id FROM current_profile()));

-- Shift Handovers: participantes + supervisor+
CREATE POLICY "shift_handovers_read" ON shift_handovers FOR SELECT
  USING (
    outgoing_employee_id = (SELECT id FROM current_profile())
    OR incoming_employee_id = (SELECT id FROM current_profile())
    OR has_any_role(ARRAY['supervisor','gerente','diretor','admin'])
  );
CREATE POLICY "shift_handovers_insert" ON shift_handovers FOR INSERT
  WITH CHECK (
    outgoing_employee_id = (SELECT id FROM current_profile())
    OR has_any_role(ARRAY['admin','gerente'])
  );

-- Audit Logs: apenas gerente+ e admin
CREATE POLICY "audit_logs_read" ON audit_logs FOR SELECT
  USING (company_id = current_company_id() AND has_any_role(ARRAY['gerente','diretor','admin']));
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT
  WITH CHECK (company_id = current_company_id());

-- Supervisor Posts
CREATE POLICY "supervisor_posts_read" ON supervisor_posts FOR SELECT
  USING (supervisor_id = (SELECT id FROM current_profile()) OR has_any_role(ARRAY['gerente','diretor','admin']));
CREATE POLICY "supervisor_posts_manage" ON supervisor_posts FOR ALL
  USING (has_any_role(ARRAY['admin','gerente']));

-- Leader Posts
CREATE POLICY "leader_posts_read" ON leader_posts FOR SELECT
  USING (leader_id = (SELECT id FROM current_profile()) OR has_any_role(ARRAY['gerente','diretor','admin']));
CREATE POLICY "leader_posts_manage" ON leader_posts FOR ALL
  USING (has_any_role(ARRAY['admin','gerente']));

-- Post Team Assignments
CREATE POLICY "post_team_read" ON post_team_assignments FOR SELECT
  USING (post_id IN (SELECT id FROM posts WHERE company_id = current_company_id()));
CREATE POLICY "post_team_manage" ON post_team_assignments FOR ALL
  USING (has_any_role(ARRAY['admin','gerente']));

-- ============================================================
-- VIEWS
-- ============================================================

-- Status Operacional dos Postos (view materializável)
CREATE OR REPLACE VIEW operational_post_status_view AS
WITH current_shifts AS (
  SELECT DISTINCT ON (s.post_id)
    s.id as schedule_id,
    s.post_id,
    s.employee_id,
    s.shift_start,
    s.shift_end
  FROM schedules s
  WHERE s.is_active = true
    AND now() BETWEEN s.shift_start AND s.shift_end
  ORDER BY s.post_id, s.shift_start DESC
),
confirmed_presences AS (
  SELECT
    p.post_id,
    COUNT(*) FILTER (WHERE p.status = 'valid') as confirmed_count,
    array_agg(DISTINCT pr.name) FILTER (WHERE p.status = 'valid') as employees_present
  FROM presences p
  JOIN profiles pr ON pr.id = p.employee_id
  WHERE p.confirmed_at >= date_trunc('day', now())
    AND p.confirmed_at < date_trunc('day', now() + interval '1 day')
  GROUP BY p.post_id
),
active_sos AS (
  SELECT post_id, COUNT(*) as sos_count
  FROM occurrences
  WHERE type = 'sos' AND status = 'aberta'
  GROUP BY post_id
),
latest_occurrence AS (
  SELECT DISTINCT ON (post_id) post_id, created_at
  FROM occurrences
  ORDER BY post_id, created_at DESC
)
SELECT
  po.id as post_id,
  po.name as post_name,
  cl.name as client_name,
  po.min_staff,
  po.company_id,
  COALESCE(cp.confirmed_count, 0) as confirmed_count,
  po.min_staff - COALESCE(cp.confirmed_count, 0) as missing_count,
  CASE
    WHEN COALESCE(sos.sos_count, 0) > 0 THEN 'sos_ativo'
    WHEN COALESCE(cp.confirmed_count, 0) >= po.min_staff THEN 'coberto'
    WHEN COALESCE(cp.confirmed_count, 0) > 0 AND COALESCE(cp.confirmed_count, 0) < po.min_staff THEN 'parcialmente_coberto'
    ELSE 'descoberto'
  END as status,
  cs.shift_start as current_shift_start,
  cs.shift_end as current_shift_end,
  sp.supervisor_id,
  COALESCE(cp.employees_present, ARRAY[]::TEXT[]) as employees_present,
  lo.created_at as last_occurrence_at,
  COALESCE(sos.sos_count, 0) as active_sos_count
FROM posts po
JOIN clients cl ON cl.id = po.client_id
LEFT JOIN confirmed_presences cp ON cp.post_id = po.id
LEFT JOIN active_sos sos ON sos.post_id = po.id
LEFT JOIN current_shifts cs ON cs.post_id = po.id
LEFT JOIN latest_occurrence lo ON lo.post_id = po.id
LEFT JOIN supervisor_posts sp ON sp.post_id = po.id
WHERE po.active = true;

-- ============================================================
-- STORAGE BUCKET
-- ============================================================

-- Criar bucket privado para evidências
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence',
  'evidence',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage policy: upload apenas por membros da empresa
CREATE POLICY "evidence_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'evidence'
    AND auth.role() = 'authenticated'
  );

-- Storage policy: leitura apenas por membros da empresa
CREATE POLICY "evidence_read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'evidence'
    AND auth.role() = 'authenticated'
  );

-- Storage policy: apenas admin/gerente pode deletar
CREATE POLICY "evidence_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'evidence'
    AND has_any_role(ARRAY['admin','gerente'])
  );
