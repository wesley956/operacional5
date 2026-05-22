-- ============================================================
-- OPERACIONAL5 — Seed Demo
-- Popula o banco com dados realistas para demonstração
-- ============================================================

-- Limpar dados existentes (ordem reversa por FK)
DELETE FROM audit_logs;
DELETE FROM alert_log;
DELETE FROM location_tracking;
DELETE FROM shift_handovers;
DELETE FROM ronda_logs;
DELETE FROM ronda_points;
DELETE FROM post_team_assignments;
DELETE FROM leader_posts;
DELETE FROM supervisor_posts;
DELETE FROM ft_requests;
DELETE FROM occurrences;
DELETE FROM presences;
DELETE FROM schedules;
DELETE FROM posts;
DELETE FROM clients;
DELETE FROM profiles;
DELETE FROM companies;

-- ============================================================
-- EMPRESA
-- ============================================================

INSERT INTO companies (id, name, cnpj, phone, email, address) VALUES
('comp-001', 'Segurança Total Proteção Ltda', '12.345.678/0001-90',
 '(11) 98765-4321', 'contato@segurancatotal.com.br',
 'Av. Paulista, 1000 - São Paulo, SP');

-- ============================================================
-- PERFIS (requer auth.users criados via Supabase Auth)
-- Nota: Em demo, user_id são UUIDs placeholder.
-- Em produção, criar via Supabase Auth primeiro.
-- ============================================================

INSERT INTO profiles (id, user_id, company_id, role, name, email, phone, ft_available, regime_trabalho, data_referencia_ciclo) VALUES
('prof-001', '00000001-0001-0001-0001-000000000001', 'comp-001', 'gerente',
 'Carlos Mendes', 'carlos@segurancatotal.com.br', '(11) 99876-5432', false, '12x36', '2024-01-01'),
('prof-002', '00000001-0001-0001-0001-000000000002', 'comp-001', 'supervisor',
 'Marcos Oliveira', 'marcos@segurancatotal.com.br', '(11) 98765-1234', false, '12x36', '2024-01-01'),
('prof-003', '00000001-0001-0001-0001-000000000003', 'comp-001', 'lider',
 'Ana Santos', 'ana@segurancatotal.com.br', '(11) 97654-3210', false, '12x36', '2024-01-01'),
('prof-004', '00000001-0001-0001-0001-000000000004', 'comp-001', 'operador',
 'João Silva', 'joao@segurancatotal.com.br', '(11) 96543-2109', false, '12x36', '2024-01-01'),
('prof-005', '00000001-0001-0001-0001-000000000005', 'comp-001', 'operador',
 'Pedro Costa', 'pedro@segurancatotal.com.br', '(11) 95432-1098', false, '12x36', '2024-01-02'),
('prof-006', '00000001-0001-0001-0001-000000000006', 'comp-001', 'operador',
 'José Ferreira', 'jose@segurancatotal.com.br', '(11) 94321-0987', true, '12x36', '2024-01-03');

-- ============================================================
-- CLIENTE
-- ============================================================

INSERT INTO clients (id, company_id, name, cnpj, contact_name, contact_phone, contact_email, address) VALUES
('client-001', 'comp-001', 'Edifícios Corporativos Plaza', '98.765.432/0001-10',
 'Roberto Almeida', '(11) 91234-5678', 'roberto@plaza.com.br',
 'Rua Augusta, 500 - São Paulo, SP');

-- ============================================================
-- POSTOS
-- ============================================================

INSERT INTO posts (id, company_id, client_id, name, address, lat, lng, radius_meters, min_staff, tolerance_minutes, require_photo, require_ronda, ronda_interval_minutes, indoor_mode, qr_code_token) VALUES
('post-001', 'comp-001', 'client-001', 'Portaria Principal - Plaza',
 'Rua Augusta, 500 - Entrada Principal',
 -23.5505, -46.6333, 50, 1, 15, true, true, 120, false, 'qr-plaza-principal-2024'),
('post-002', 'comp-001', 'client-001', 'Estacionamento Subsolo - Plaza',
 'Rua Augusta, 500 - Estacionamento B2',
 -23.5510, -46.6340, 100, 1, 15, true, true, 90, true, 'qr-plaza-estacionamento-2024'),
('post-003', 'comp-001', 'client-001', 'Portaria Torre B - Plaza',
 'Rua Augusta, 520 - Torre B',
 -23.5600, -46.6500, 75, 2, 15, true, false, 120, false, 'qr-plaza-torreb-2024');

-- ============================================================
-- ATRIBUIÇÕES
-- ============================================================

INSERT INTO supervisor_posts (supervisor_id, post_id) VALUES
('prof-002', 'post-001'),
('prof-002', 'post-002'),
('prof-002', 'post-003');

INSERT INTO leader_posts (leader_id, post_id) VALUES
('prof-003', 'post-001'),
('prof-003', 'post-002');

-- ============================================================
-- ESCALAS (turno atual)
-- ============================================================

INSERT INTO schedules (id, company_id, post_id, employee_id, shift_start, shift_end, regime, cycle_reference_date) VALUES
('sched-001', 'comp-001', 'post-001', 'prof-004',
 (SELECT date_trunc('day', now()) + interval '6 hours'),
 (SELECT date_trunc('day', now()) + interval '18 hours'),
 '12x36', '2024-01-01'),
('sched-002', 'comp-001', 'post-002', 'prof-005',
 (SELECT date_trunc('day', now()) + interval '6 hours'),
 (SELECT date_trunc('day', now()) + interval '18 hours'),
 '12x36', '2024-01-02'),
('sched-003', 'comp-001', 'post-003', 'prof-006',
 (SELECT date_trunc('day', now()) + interval '6 hours'),
 (SELECT date_trunc('day', now()) + interval '18 hours'),
 '12x36', '2024-01-03');

-- ============================================================
-- PRESENÇAS
-- ============================================================

INSERT INTO presences (id, schedule_id, employee_id, post_id, confirmed_at, gps_lat, gps_lng, gps_valid, accuracy, validation_method, is_mock_location, status, idempotency_key) VALUES
('pres-001', 'sched-001', 'prof-004', 'post-001',
 now() - interval '4 hours', -23.5504, -46.6332, true, 12, 'gps', false, 'valid', 'idem-pres-001'),
('pres-002', 'sched-002', 'prof-005', 'post-002',
 now() - interval '3 hours', -23.5512, -46.6345, true, 8, 'qr', false, 'valid', 'idem-pres-002');

-- ============================================================
-- OCORRÊNCIAS
-- ============================================================

INSERT INTO occurrences (id, company_id, post_id, employee_id, type, severity, description, status, idempotency_key) VALUES
('occ-001', 'comp-001', 'post-003', 'prof-006', 'suspeito', 'media',
 'Indivíduo suspeito rondando a portaria da Torre B. Usava moletom com capuz e tentou entrar sem crachá.',
 'aberta', 'idem-occ-001'),
('occ-002', 'comp-001', 'post-001', 'prof-004', 'sos', 'critica',
 'SOS disparado pelo operador. Agressão verbal por morador no hall de entrada.',
 'aberta', 'idem-occ-002-sos'),
('occ-003', 'comp-001', 'post-002', 'prof-005', 'dano', 'baixa',
 'Câmera de segurança do estacionamento B2 com vidro trincado.',
 'em_tratamento', 'idem-occ-003');

-- Update ack for occ-003
UPDATE occurrences SET ack_supervisor = 'prof-002' WHERE id = 'occ-003';

-- ============================================================
-- FT REQUESTS
-- ============================================================

INSERT INTO ft_requests (id, company_id, post_id, opened_by, reason, urgency, status, opened_at, notes) VALUES
('ft-001', 'comp-001', 'post-003', 'prof-002', 'ausencia', 'alta', 'aberta',
 now() - interval '35 minutes',
 'Operador escalado não compareceu. Torre B com 0 de 2 vigilantes.');

-- ============================================================
-- ALERTAS
-- ============================================================

INSERT INTO alert_log (id, company_id, type, target_user_id, post_id, occurrence_id, payload, channel, status) VALUES
('alert-001', 'comp-001', 'sos', 'prof-002', 'post-001', 'occ-002',
 '{"message":"SOS disparado por João Silva na Portaria Principal"}'::jsonb, 'system', 'sent'),
('alert-002', 'comp-001', 'ausencia', 'prof-002', 'post-003', NULL,
 '{"message":"Torre B sem vigilante após tolerância de 15min"}'::jsonb, 'system', 'sent'),
('alert-003', 'comp-001', 'ocorrencia_critica', 'prof-001', 'post-001', 'occ-002',
 '{"message":"SOS ativo na Portaria Principal - Plaza"}'::jsonb, 'system', 'sent'),
('alert-004', 'comp-001', 'ft_aberta', 'prof-001', 'post-003', NULL,
 '{"message":"FT aberta para Torre B - motivo: ausência"}'::jsonb, 'system', 'sent');

-- Escalated alerts
UPDATE alert_log SET escalated = true WHERE id IN ('alert-003');

-- ============================================================
-- RONDA POINTS
-- ============================================================

INSERT INTO ronda_points (id, post_id, name, lat, lng, radius_meters, sequence_order, require_photo) VALUES
('rp-001', 'post-001', 'Hall Principal', -23.5503, -46.6332, 20, 1, false),
('rp-002', 'post-001', 'Elevadores Bloco A', -23.5506, -46.6335, 20, 2, false),
('rp-003', 'post-001', 'Garagem Nível 1', -23.5508, -46.6330, 20, 3, true),
('rp-004', 'post-002', 'Entrada Estacionamento', -23.5509, -46.6342, 30, 1, false),
('rp-005', 'post-002', 'Setor B2', -23.5511, -46.6344, 30, 2, true),
('rp-006', 'post-002', 'Saída Emergência', -23.5512, -46.6338, 20, 3, false);

-- ============================================================
-- AUDIT LOGS (exemplos)
-- ============================================================

SELECT write_audit('comp-001', 'prof-001', 'login', 'auth', 'prof-001', '{"method":"email_password"}'::jsonb);
SELECT write_audit('comp-001', 'prof-004', 'checkin', 'presence', 'pres-001', '{"method":"gps","distance_m":12.5}'::jsonb);
SELECT write_audit('comp-001', 'prof-005', 'checkin', 'presence', 'pres-002', '{"method":"qr","has_photo":true}'::jsonb);
SELECT write_audit('comp-001', 'prof-002' , 'sos_triggered', 'occurrence', 'occ-002', '{"post":"Portaria Principal","employee":"João Silva"}'::jsonb);
SELECT write_audit('comp-001', 'prof-002', 'ft_opened', 'ft_request', 'ft-001', '{"post":"Portaria Torre B","reason":"ausencia"}'::jsonb);
SELECT write_audit('comp-001', 'prof-006', 'occurrence_created', 'occurrence', 'occ-001', '{"type":"suspeito","severity":"media"}'::jsonb);
