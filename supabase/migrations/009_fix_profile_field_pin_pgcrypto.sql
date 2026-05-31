-- 009_fix_profile_field_pin_pgcrypto.sql
-- Corrige uso de pgcrypto em funções de PIN de campo.
-- No Supabase, pgcrypto normalmente fica no schema extensions.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.verify_profile_field_pin(
  p_profile_id UUID,
  p_plain_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT field_pin_hash INTO stored_hash
  FROM public.profiles
  WHERE id = p_profile_id
  LIMIT 1;

  -- Se não existe PIN configurado, aceita apenas código + foto.
  IF stored_hash IS NULL OR length(stored_hash) = 0 THEN
    RETURN TRUE;
  END IF;

  IF p_plain_pin IS NULL OR length(trim(p_plain_pin)) = 0 THEN
    RETURN FALSE;
  END IF;

  RETURN extensions.crypt(p_plain_pin, stored_hash) = stored_hash;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_profile_field_pin(
  p_profile_id UUID,
  p_plain_pin TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_plain_pin IS NULL OR length(trim(p_plain_pin)) < 4 THEN
    RAISE EXCEPTION 'PIN deve ter pelo menos 4 caracteres.';
  END IF;

  UPDATE public.profiles
  SET field_pin_hash = extensions.crypt(p_plain_pin, extensions.gen_salt('bf')),
      field_code_updated_at = now()
  WHERE id = p_profile_id;
END;
$$;
