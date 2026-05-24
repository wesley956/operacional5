-- ============================================================
-- OPERACIONAL5 — Migration 002: Security Fixes
-- Correções críticas antes da camada SaaS multi-tenant.
-- ============================================================

-- IMPORTANTE PARA STORAGE:
-- Os arquivos do bucket evidence devem ser gravados com o primeiro segmento
-- do caminho igual ao company_id do usuário autenticado.
-- Exemplo correto em storage.objects.name:
--   {company_id}/occurrences/{post_id}/2026-05/arquivo.jpg
-- O bucket_id continua sendo 'evidence'. Não incluir 'evidence/' no começo do name.

-- Recria policies inseguras do bucket evidence.
DROP POLICY IF EXISTS "evidence_upload" ON storage.objects;
DROP POLICY IF EXISTS "evidence_read" ON storage.objects;
DROP POLICY IF EXISTS "evidence_delete" ON storage.objects;

CREATE POLICY "evidence_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'evidence'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = current_company_id()::text
  );

CREATE POLICY "evidence_read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'evidence'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = current_company_id()::text
  );

CREATE POLICY "evidence_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'evidence'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = current_company_id()::text
    AND has_any_role(ARRAY['admin','gerente'])
  );

-- Corrige can_access_post para impedir acesso a posto de outra empresa mesmo
-- se houver vínculo acidental em supervisor_posts/leader_posts.
CREATE OR REPLACE FUNCTION can_access_post(target_post_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  p RECORD;
BEGIN
  p := current_profile();

  IF p.id IS NULL OR p.active IS DISTINCT FROM true THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM posts
    WHERE id = target_post_id
      AND company_id = p.company_id
      AND active = true
  ) THEN
    RETURN false;
  END IF;

  -- Gerente, Diretor e Admin acessam todos os postos da própria empresa.
  IF p.role IN ('gerente','diretor','admin') THEN
    RETURN true;
  END IF;

  -- Supervisor acessa postos atribuídos dentro da própria empresa.
  IF p.role = 'supervisor' THEN
    RETURN EXISTS (
      SELECT 1
      FROM supervisor_posts sp
      JOIN posts po ON po.id = sp.post_id
      WHERE sp.supervisor_id = p.id
        AND sp.post_id = target_post_id
        AND po.company_id = p.company_id
    );
  END IF;

  -- Líder acessa postos atribuídos dentro da própria empresa.
  IF p.role = 'lider' THEN
    RETURN EXISTS (
      SELECT 1
      FROM leader_posts lp
      JOIN posts po ON po.id = lp.post_id
      WHERE lp.leader_id = p.id
        AND lp.post_id = target_post_id
        AND po.company_id = p.company_id
    );
  END IF;

  -- Operador acessa posto do turno atual dentro da própria empresa.
  IF p.role = 'operador' THEN
    RETURN EXISTS (
      SELECT 1
      FROM schedules s
      WHERE s.employee_id = p.id
        AND s.post_id = target_post_id
        AND s.company_id = p.company_id
        AND s.is_active = true
        AND now() BETWEEN s.shift_start AND s.shift_end
    );
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Torna o sync offline idempotente também para registros que ainda não tinham
-- colunas de sincronização. Mantém compatibilidade com dados existentes.
ALTER TABLE occurrences ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;
ALTER TABLE ronda_logs ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;
ALTER TABLE shift_handovers ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
ALTER TABLE shift_handovers ADD COLUMN IF NOT EXISTS offline_created_at TIMESTAMPTZ;
ALTER TABLE shift_handovers ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_occurrences_synced_at ON occurrences(synced_at);
CREATE INDEX IF NOT EXISTS idx_ronda_logs_synced_at ON ronda_logs(synced_at);
CREATE INDEX IF NOT EXISTS idx_shift_handovers_idempotency ON shift_handovers(idempotency_key);

-- Recria a view operacional como security_invoker e já filtrada por company_id.
-- Assim ela respeita o contexto RLS do usuário autenticado.
CREATE OR REPLACE VIEW operational_post_status_view
WITH (security_invoker = true) AS
WITH current_shifts AS (
  SELECT DISTINCT ON (s.post_id)
    s.id as schedule_id,
    s.post_id,
    s.employee_id,
    s.shift_start,
    s.shift_end
  FROM schedules s
  WHERE s.is_active = true
    AND s.company_id = current_company_id()
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
  JOIN posts po ON po.id = p.post_id
  WHERE po.company_id = current_company_id()
    AND p.confirmed_at >= date_trunc('day', now())
    AND p.confirmed_at < date_trunc('day', now() + interval '1 day')
  GROUP BY p.post_id
),
active_sos AS (
  SELECT post_id, COUNT(*) as sos_count
  FROM occurrences
  WHERE company_id = current_company_id()
    AND type = 'sos'
    AND status = 'aberta'
  GROUP BY post_id
),
latest_occurrence AS (
  SELECT DISTINCT ON (post_id) post_id, created_at
  FROM occurrences
  WHERE company_id = current_company_id()
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
JOIN clients cl ON cl.id = po.client_id AND cl.company_id = po.company_id
LEFT JOIN confirmed_presences cp ON cp.post_id = po.id
LEFT JOIN active_sos sos ON sos.post_id = po.id
LEFT JOIN current_shifts cs ON cs.post_id = po.id
LEFT JOIN latest_occurrence lo ON lo.post_id = po.id
LEFT JOIN supervisor_posts sp ON sp.post_id = po.id
WHERE po.active = true
  AND po.company_id = current_company_id();

COMMENT ON VIEW operational_post_status_view IS
  'View operacional filtrada por current_company_id() e criada com security_invoker para respeitar RLS.';
