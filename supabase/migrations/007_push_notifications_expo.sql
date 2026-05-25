-- 007_push_notifications_expo.sql
-- Complementos para push notifications via Expo Push Service.

ALTER TABLE public.device_tokens
  ADD COLUMN IF NOT EXISTS token_type TEXT NOT NULL DEFAULT 'expo',
  ADD COLUMN IF NOT EXISTS device_name TEXT,
  ADD COLUMN IF NOT EXISTS app_version TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'device_tokens_token_type_check'
      AND conrelid = 'public.device_tokens'::regclass
  ) THEN
    ALTER TABLE public.device_tokens
      ADD CONSTRAINT device_tokens_token_type_check
      CHECK (token_type IN ('expo','fcm','apns'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS device_tokens_company_active_idx
  ON public.device_tokens (company_id, active);

CREATE INDEX IF NOT EXISTS device_tokens_user_active_idx
  ON public.device_tokens (user_id, active);

COMMENT ON COLUMN public.device_tokens.token_type IS
  'Tipo do token de push: expo, fcm ou apns. A fase atual usa expo.';
