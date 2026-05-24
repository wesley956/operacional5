-- ============================================================
-- OPERACIONAL5 — Migration 003: SaaS Multi-Tenant Schema
-- Estrutura de plataforma, planos, assinatura, settings e auditoria global.
-- ============================================================

-- Campos comerciais e cadastrais no tenant root.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS legal_name TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS document TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'pt-BR';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trialing';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'companies_subscription_status_check'
  ) THEN
    ALTER TABLE companies
      ADD CONSTRAINT companies_subscription_status_check
      CHECK (subscription_status IN ('trialing','active','suspended','cancelled','expired'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS companies_document_unique_idx
  ON companies(document)
  WHERE document IS NOT NULL AND document <> '';

CREATE INDEX IF NOT EXISTS idx_companies_subscription_status ON companies(subscription_status);
CREATE INDEX IF NOT EXISTS idx_companies_last_access_at ON companies(last_access_at);

-- Administradores da plataforma. Separado de profiles para não misturar
-- permissões globais com permissões de uma empresa/tenant.
CREATE TABLE IF NOT EXISTS platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_admins_user_id ON platform_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_admins_active ON platform_admins(active) WHERE active = true;

-- Planos comerciais.
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  max_users INTEGER,
  max_posts INTEGER,
  max_storage_mb INTEGER,
  push_notifications BOOLEAN DEFAULT false,
  advanced_reports BOOLEAN DEFAULT false,
  mobile_access BOOLEAN DEFAULT true,
  price_monthly_brl NUMERIC(10,2),
  trial_days INTEGER DEFAULT 14,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plans_name ON plans(name);
CREATE INDEX IF NOT EXISTS idx_plans_active ON plans(active) WHERE active = true;

-- Assinatura/status comercial da empresa.
CREATE TABLE IF NOT EXISTS company_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan_id UUID REFERENCES plans(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing','active','past_due','suspended','cancelled')),
  trial_starts_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  suspension_reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES platform_admins(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_subscriptions_company_id ON company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_plan_id ON company_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_status ON company_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_trial_ends_at ON company_subscriptions(trial_ends_at);

-- Configurações operacionais por empresa.
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#1e40af',
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  tolerance_minutes INTEGER DEFAULT 15 CHECK (tolerance_minutes >= 0),
  default_gps_radius INTEGER DEFAULT 50 CHECK (default_gps_radius > 0),
  min_gps_accuracy INTEGER DEFAULT 50 CHECK (min_gps_accuracy > 0),
  require_photo BOOLEAN DEFAULT true,
  detect_mock_location BOOLEAN DEFAULT true,
  ronda_interval_minutes INTEGER DEFAULT 120 CHECK (ronda_interval_minutes > 0),
  notify_sos BOOLEAN DEFAULT true,
  notify_absence BOOLEAN DEFAULT true,
  notify_mock_location BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_settings_company_id ON company_settings(company_id);

-- Convites de onboarding/usuários.
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('operador','lider','supervisor','gerente','diretor','admin')),
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  invited_by UUID,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_company_id ON invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(lower(email));
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at);

-- Tokens de push por dispositivo.
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android','ios','web')),
  active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_company_id ON device_tokens(company_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens(active) WHERE active = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_tokens_token_unique ON device_tokens(token);

-- Logs de notificações.
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  alert_log_id UUID REFERENCES alert_log(id),
  target_user_id UUID REFERENCES profiles(id),
  device_token_id UUID REFERENCES device_tokens(id),
  channel TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','failed')),
  fcm_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_company_id ON notification_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_target_user_id ON notification_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at);

-- Auditoria global da plataforma.
CREATE TABLE IF NOT EXISTS global_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES platform_admins(id),
  actor_type TEXT DEFAULT 'platform_admin',
  action TEXT NOT NULL,
  target_company_id UUID REFERENCES companies(id),
  target_user_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_global_audit_logs_actor_id ON global_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_global_audit_logs_action ON global_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_global_audit_logs_target_company_id ON global_audit_logs(target_company_id);
CREATE INDEX IF NOT EXISTS idx_global_audit_logs_created_at ON global_audit_logs(created_at);

-- Helper: identifica se o auth.uid() atual é administrador ativo da plataforma.
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM platform_admins
    WHERE user_id = auth.uid()
      AND active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated;

-- RLS das novas tabelas.
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies idempotentes.
DROP POLICY IF EXISTS "platform_admins_read_self" ON platform_admins;
CREATE POLICY "platform_admins_read_self" ON platform_admins FOR SELECT
  USING (user_id = auth.uid() AND active = true);

DROP POLICY IF EXISTS "plans_read_active" ON plans;
CREATE POLICY "plans_read_active" ON plans FOR SELECT
  USING (active = true AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "company_subscriptions_read" ON company_subscriptions;
CREATE POLICY "company_subscriptions_read" ON company_subscriptions FOR SELECT
  USING (company_id = current_company_id() OR is_platform_admin());

DROP POLICY IF EXISTS "company_settings_read" ON company_settings;
CREATE POLICY "company_settings_read" ON company_settings FOR SELECT
  USING (company_id = current_company_id() OR is_platform_admin());

DROP POLICY IF EXISTS "company_settings_insert" ON company_settings;
CREATE POLICY "company_settings_insert" ON company_settings FOR INSERT
  WITH CHECK (company_id = current_company_id() AND has_any_role(ARRAY['admin','gerente']));

DROP POLICY IF EXISTS "company_settings_update" ON company_settings;
CREATE POLICY "company_settings_update" ON company_settings FOR UPDATE
  USING (company_id = current_company_id() AND has_any_role(ARRAY['admin','gerente']))
  WITH CHECK (company_id = current_company_id() AND has_any_role(ARRAY['admin','gerente']));

DROP POLICY IF EXISTS "invitations_read_company" ON invitations;
CREATE POLICY "invitations_read_company" ON invitations FOR SELECT
  USING (company_id = current_company_id() OR is_platform_admin());

DROP POLICY IF EXISTS "invitations_manage_company" ON invitations;
CREATE POLICY "invitations_manage_company" ON invitations FOR ALL
  USING (company_id = current_company_id() AND has_any_role(ARRAY['admin','gerente']))
  WITH CHECK (company_id = current_company_id() AND has_any_role(ARRAY['admin','gerente']));

DROP POLICY IF EXISTS "device_tokens_read_own" ON device_tokens;
CREATE POLICY "device_tokens_read_own" ON device_tokens FOR SELECT
  USING (user_id = (SELECT id FROM current_profile()) OR is_platform_admin());

DROP POLICY IF EXISTS "device_tokens_insert_own" ON device_tokens;
CREATE POLICY "device_tokens_insert_own" ON device_tokens FOR INSERT
  WITH CHECK (
    user_id = (SELECT id FROM current_profile())
    AND company_id = current_company_id()
  );

DROP POLICY IF EXISTS "device_tokens_update_own" ON device_tokens;
CREATE POLICY "device_tokens_update_own" ON device_tokens FOR UPDATE
  USING (user_id = (SELECT id FROM current_profile()))
  WITH CHECK (
    user_id = (SELECT id FROM current_profile())
    AND company_id = current_company_id()
  );

DROP POLICY IF EXISTS "notification_logs_read_company" ON notification_logs;
CREATE POLICY "notification_logs_read_company" ON notification_logs FOR SELECT
  USING (
    company_id = current_company_id()
    AND (
      target_user_id = (SELECT id FROM current_profile())
      OR has_any_role(ARRAY['supervisor','gerente','diretor','admin'])
    )
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "global_audit_logs_read_platform" ON global_audit_logs;
CREATE POLICY "global_audit_logs_read_platform" ON global_audit_logs FOR SELECT
  USING (is_platform_admin());

-- Atualiza policy de companies para permitir que SuperAdmin leia todas as empresas.
DROP POLICY IF EXISTS "companies_read_own" ON companies;
CREATE POLICY "companies_read_own" ON companies FOR SELECT
  USING (id = current_company_id() OR is_platform_admin());

-- Seeds de planos básicos.
INSERT INTO plans (
  name,
  display_name,
  max_users,
  max_posts,
  max_storage_mb,
  push_notifications,
  advanced_reports,
  mobile_access,
  price_monthly_brl,
  trial_days,
  active
) VALUES
  ('free_trial', 'Teste grátis', 10, 5, 512, false, false, true, 0.00, 14, true),
  ('basic', 'Basic', 50, 20, 2048, false, false, true, 199.00, 14, true),
  ('professional', 'Professional', 200, 100, 10240, true, true, true, 499.00, 14, true),
  ('enterprise', 'Enterprise', NULL, NULL, NULL, true, true, true, NULL, 14, true)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  max_users = EXCLUDED.max_users,
  max_posts = EXCLUDED.max_posts,
  max_storage_mb = EXCLUDED.max_storage_mb,
  push_notifications = EXCLUDED.push_notifications,
  advanced_reports = EXCLUDED.advanced_reports,
  mobile_access = EXCLUDED.mobile_access,
  price_monthly_brl = EXCLUDED.price_monthly_brl,
  trial_days = EXCLUDED.trial_days,
  active = EXCLUDED.active;

-- Garante settings para empresas já existentes.
INSERT INTO company_settings (company_id, timezone, tolerance_minutes, default_gps_radius, min_gps_accuracy, require_photo, detect_mock_location, ronda_interval_minutes)
SELECT id, timezone, tolerance_minutes, default_gps_radius, min_gps_accuracy, require_photo, detect_mock_location, 120
FROM companies
ON CONFLICT (company_id) DO NOTHING;

-- Garante assinatura trial para empresas existentes quando houver plano free_trial.
INSERT INTO company_subscriptions (company_id, plan_id, status, trial_starts_at, trial_ends_at)
SELECT
  c.id,
  p.id,
  CASE
    WHEN c.subscription_status IN ('trialing','active','suspended','cancelled') THEN c.subscription_status
    WHEN c.subscription_status = 'expired' THEN 'past_due'
    ELSE 'trialing'
  END,
  c.created_at,
  c.created_at + interval '14 days'
FROM companies c
JOIN plans p ON p.name = 'free_trial'
ON CONFLICT (company_id) DO NOTHING;

COMMENT ON TABLE platform_admins IS 'Administradores globais da plataforma; separados dos perfis de tenant.';
COMMENT ON TABLE company_subscriptions IS 'Controle comercial de trial, ativação, suspensão e cancelamento por empresa.';
COMMENT ON TABLE company_settings IS 'Configurações operacionais e visuais por tenant.';
COMMENT ON TABLE global_audit_logs IS 'Auditoria de ações globais executadas pelo SuperAdmin ou sistema.';
