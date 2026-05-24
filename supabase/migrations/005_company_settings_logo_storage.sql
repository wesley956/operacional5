-- ============================================================
-- OPERACIONAL5 — Fase 5: Settings reais e Storage de logos
-- ============================================================
-- Cria bucket de logos e policies para upload isolado por company_id.
-- A leitura é pública porque a logo da empresa é material de branding.
-- A escrita continua restrita a admin/gerente do próprio tenant.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  2097152,
  ARRAY['image/jpeg','image/png','image/webp','image/svg+xml']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "logos_public_read" ON storage.objects;
CREATE POLICY "logos_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos_company_insert" ON storage.objects;
CREATE POLICY "logos_company_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'logos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = current_company_id()::text
    AND has_any_role(ARRAY['admin','gerente'])
  );

DROP POLICY IF EXISTS "logos_company_update" ON storage.objects;
CREATE POLICY "logos_company_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'logos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = current_company_id()::text
    AND has_any_role(ARRAY['admin','gerente'])
  )
  WITH CHECK (
    bucket_id = 'logos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = current_company_id()::text
    AND has_any_role(ARRAY['admin','gerente'])
  );

DROP POLICY IF EXISTS "logos_company_delete" ON storage.objects;
CREATE POLICY "logos_company_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'logos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = current_company_id()::text
    AND has_any_role(ARRAY['admin','gerente'])
  );
