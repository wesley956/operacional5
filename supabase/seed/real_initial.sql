-- ============================================================
-- OPERACIONAL5 — Seed Inicial Real
-- Seguro para ambiente inicial: usa UUIDs válidos e ON CONFLICT.
-- Não apaga dados existentes.
-- ============================================================

-- EMPRESA
INSERT INTO companies (id, name, cnpj, phone, email, address)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'Operacional5 Demo Segurança Ltda',
  '12.345.678/0001-90',
  '(11) 99999-0000',
  'contato@operacional5.com',
  'São Paulo, SP'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  address = EXCLUDED.address,
  updated_at = now();

-- CLIENTE
INSERT INTO clients (id, company_id, name, cnpj, contact_name, contact_phone, contact_email, address, active)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Cliente Demo Plaza',
  '98.765.432/0001-10',
  'Responsável Demo',
  '(11) 98888-0000',
  'cliente@operacional5.com',
  'Rua Demo, 100 - São Paulo, SP',
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  contact_name = EXCLUDED.contact_name,
  contact_phone = EXCLUDED.contact_phone,
  contact_email = EXCLUDED.contact_email,
  address = EXCLUDED.address,
  active = EXCLUDED.active,
  updated_at = now();

-- PERFIS REAIS VINCULADOS AO SUPABASE AUTH
-- Busca user_id pelo email em auth.users para evitar erro de UUID digitado errado.
INSERT INTO profiles (
  id, user_id, company_id, role, name, email, phone,
  ft_available, regime_trabalho, data_referencia_ciclo, active
)
VALUES
(
  '33333333-3333-4333-8333-333333333331',
  (SELECT id FROM auth.users WHERE email = 'gerente@operacional5.com'),
  '11111111-1111-4111-8111-111111111111',
  'gerente',
  'Gerente Operacional5',
  'gerente@operacional5.com',
  '(11) 90000-0001',
  false,
  '12x36',
  '2024-01-01',
  true
),
(
  '33333333-3333-4333-8333-333333333332',
  (SELECT id FROM auth.users WHERE email = 'supervisor@operacional5.com'),
  '11111111-1111-4111-8111-111111111111',
  'supervisor',
  'Supervisor Operacional5',
  'supervisor@operacional5.com',
  '(11) 90000-0002',
  false,
  '12x36',
  '2024-01-01',
  true
),
(
  '33333333-3333-4333-8333-333333333333',
  (SELECT id FROM auth.users WHERE email = 'operador@operacional5.com'),
  '11111111-1111-4111-8111-111111111111',
  'operador',
  'Operador Operacional5',
  'operador@operacional5.com',
  '(11) 90000-0003',
  true,
  '12x36',
  '2024-01-01',
  true
)
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  company_id = EXCLUDED.company_id,
  role = EXCLUDED.role,
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  ft_available = EXCLUDED.ft_available,
  regime_trabalho = EXCLUDED.regime_trabalho,
  data_referencia_ciclo = EXCLUDED.data_referencia_ciclo,
  active = EXCLUDED.active,
  updated_at = now();

-- POSTOS
INSERT INTO posts (
  id, company_id, client_id, name, address,
  lat, lng, radius_meters, min_staff, tolerance_minutes,
  require_photo, require_ronda, ronda_interval_minutes,
  indoor_mode, qr_code_token, active
)
VALUES
(
  '44444444-4444-4444-8444-444444444441',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  'Portaria Principal Demo',
  'Rua Demo, 100 - Entrada Principal',
  -23.5505,
  -46.6333,
  80,
  1,
  15,
  true,
  true,
  120,
  false,
  'qr-demo-portaria-principal',
  true
),
(
  '44444444-4444-4444-8444-444444444442',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  'Estacionamento Demo',
  'Rua Demo, 100 - Estacionamento',
  -23.5510,
  -46.6340,
  100,
  1,
  15,
  true,
  true,
  90,
  true,
  'qr-demo-estacionamento',
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  radius_meters = EXCLUDED.radius_meters,
  min_staff = EXCLUDED.min_staff,
  tolerance_minutes = EXCLUDED.tolerance_minutes,
  require_photo = EXCLUDED.require_photo,
  require_ronda = EXCLUDED.require_ronda,
  ronda_interval_minutes = EXCLUDED.ronda_interval_minutes,
  indoor_mode = EXCLUDED.indoor_mode,
  qr_code_token = EXCLUDED.qr_code_token,
  active = EXCLUDED.active,
  updated_at = now();

-- ATRIBUIÇÃO DO SUPERVISOR
INSERT INTO supervisor_posts (supervisor_id, post_id)
VALUES
('33333333-3333-4333-8333-333333333332', '44444444-4444-4444-8444-444444444441'),
('33333333-3333-4333-8333-333333333332', '44444444-4444-4444-8444-444444444442')
ON CONFLICT (supervisor_id, post_id) DO NOTHING;

-- ATRIBUIÇÃO DE EQUIPE
INSERT INTO post_team_assignments (post_id, employee_id, role_at_post)
VALUES
('44444444-4444-4444-8444-444444444441', '33333333-3333-4333-8333-333333333333', 'vigilante'),
('44444444-4444-4444-8444-444444444442', '33333333-3333-4333-8333-333333333333', 'vigilante')
ON CONFLICT (post_id, employee_id) DO NOTHING;

-- ESCALA DO OPERADOR
INSERT INTO schedules (
  id, company_id, post_id, employee_id,
  shift_start, shift_end, regime, cycle_reference_date,
  is_active, status
)
VALUES (
  '55555555-5555-4555-8555-555555555551',
  '11111111-1111-4111-8111-111111111111',
  '44444444-4444-4444-8444-444444444441',
  '33333333-3333-4333-8333-333333333333',
  date_trunc('day', now()) + interval '6 hours',
  date_trunc('day', now()) + interval '18 hours',
  '12x36',
  '2024-01-01',
  true,
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  shift_start = EXCLUDED.shift_start,
  shift_end = EXCLUDED.shift_end,
  is_active = EXCLUDED.is_active,
  status = EXCLUDED.status,
  updated_at = now();

-- PONTOS DE RONDA
INSERT INTO ronda_points (
  id, post_id, name, lat, lng,
  radius_meters, sequence_order, require_photo, active
)
VALUES
(
  '66666666-6666-4666-8666-666666666661',
  '44444444-4444-4444-8444-444444444441',
  'Hall Principal',
  -23.5504,
  -46.6332,
  30,
  1,
  false,
  true
),
(
  '66666666-6666-4666-8666-666666666662',
  '44444444-4444-4444-8444-444444444441',
  'Garagem',
  -23.5508,
  -46.6330,
  30,
  2,
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  radius_meters = EXCLUDED.radius_meters,
  sequence_order = EXCLUDED.sequence_order,
  require_photo = EXCLUDED.require_photo,
  active = EXCLUDED.active;

-- AUDITORIA INICIAL
SELECT write_audit(
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333331',
  'seed_real_initial',
  'system',
  'real_initial',
  '{"source":"supabase_sql_editor"}'::jsonb
);
