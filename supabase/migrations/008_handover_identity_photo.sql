CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS field_code TEXT,
  ADD COLUMN IF NOT EXISTS field_pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS field_code_updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.profiles
SET field_code = upper(substr(replace(id::text, '-', ''), 1, 8)),
    field_code_updated_at = coalesce(field_code_updated_at, now())
WHERE field_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_company_field_code_unique
  ON public.profiles (company_id, field_code)
  WHERE field_code IS NOT NULL;

ALTER TABLE public.shift_handovers
  ADD COLUMN IF NOT EXISTS incoming_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS gps_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS gps_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS gps_valid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS device_info JSONB;

CREATE OR REPLACE FUNCTION public.verify_profile_field_pin(p_profile_id UUID, p_plain_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT field_pin_hash INTO stored_hash FROM public.profiles WHERE id = p_profile_id LIMIT 1;
  IF stored_hash IS NULL OR length(stored_hash) = 0 THEN RETURN TRUE; END IF;
  IF p_plain_pin IS NULL OR length(trim(p_plain_pin)) = 0 THEN RETURN FALSE; END IF;
  RETURN crypt(p_plain_pin, stored_hash) = stored_hash;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_profile_field_pin(p_profile_id UUID, p_plain_pin TEXT)
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
