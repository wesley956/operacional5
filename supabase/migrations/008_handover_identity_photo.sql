-- 008_handover_identity_photo.sql
-- Modo aparelho do posto na passagem de plantão:
-- funcionário que assume é identificado por código/matrícula + foto, com PIN opcional.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS field_code TEXT,
  ADD COLUMN IF NOT EXISTS field_pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS field_code_updated_at TIMESTAMPTZ DEFAULT now();

-- Preenche quem ainda não tem código.
UPDATE public.profiles
SET field_code = 'AUTO-' || upper(replace(id::text, '-', '')),
    field_code_updated_at = now()
WHERE field_code IS NULL
   OR btrim(field_code) = '';

-- Corrige códigos duplicados já existentes antes de criar índice único.
-- Preserva códigos únicos e troca apenas os duplicados.
WITH duplicated AS (
  SELECT
    id,
    company_id,
    field_code,
    count(*) OVER (PARTITION BY company_id, field_code) AS duplicate_count
  FROM public.profiles
  WHERE field_code IS NOT NULL
    AND btrim(field_code) <> ''
)
UPDATE public.profiles p
SET field_code = 'AUTO-' || upper(replace(p.id::text, '-', '')),
    field_code_updated_at = now()
FROM duplicated d
WHERE p.id = d.id
  AND d.duplicate_count > 1;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_company_field_code_unique
  ON public.profiles (company_id, field_code)
  WHERE field_code IS NOT NULL;

COMMENT ON COLUMN public.profiles.field_code IS
  'Código/matrícula usado pelo funcionário no aparelho fixo do posto.';
COMMENT ON COLUMN public.profiles.field_pin_hash IS
  'Hash opcional do PIN de campo. Se preenchido, o PIN será exigido na validação.';

ALTER TABLE public.shift_handovers
  ADD COLUMN IF NOT EXISTS incoming_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS gps_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS gps_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS gps_valid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS device_info JSONB;

COMMENT ON COLUMN public.shift_handovers.incoming_photo_url IS
  'Foto/selfie do funcionário que assumiu o posto durante a passagem de plantão.';

CREATE OR REPLACE FUNCTION public.verify_profile_field_pin(
  p_profile_id UUID,
  p_plain_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT field_pin_hash INTO stored_hash
  FROM public.profiles
  WHERE id = p_profile_id
  LIMIT 1;

  -- Se não existe PIN configurado, a fase atual aceita apenas código + foto.
  IF stored_hash IS NULL OR length(stored_hash) = 0 THEN
    RETURN TRUE;
  END IF;

  IF p_plain_pin IS NULL OR length(trim(p_plain_pin)) = 0 THEN
    RETURN FALSE;
  END IF;

  RETURN crypt(p_plain_pin, stored_hash) = stored_hash;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_profile_field_pin(
  p_profile_id UUID,
  p_plain_pin TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_plain_pin IS NULL OR length(trim(p_plain_pin)) < 4 THEN
    RAISE EXCEPTION 'PIN deve ter pelo menos 4 caracteres.';
  END IF;

  UPDATE public.profiles
  SET field_pin_hash = crypt(p_plain_pin, gen_salt('bf')),
      field_code_updated_at = now()
  WHERE id = p_profile_id;
END;
$$;
