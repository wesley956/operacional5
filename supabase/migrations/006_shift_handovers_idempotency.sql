-- 006_shift_handovers_idempotency.sql
-- Permite sincronização offline idempotente de passagens de plantão.
-- A coluna é nullable para não quebrar registros antigos, mas única quando preenchida.

ALTER TABLE public.shift_handovers
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS shift_handovers_idempotency_key_unique
  ON public.shift_handovers (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.shift_handovers.idempotency_key IS
  'Chave idempotente enviada pelo app mobile para evitar duplicidade em sincronização offline.';
