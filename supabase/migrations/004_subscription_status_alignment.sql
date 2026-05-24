-- ============================================================
-- OPERACIONAL5 — Migration 004: Subscription status alignment
-- Alinha company_subscriptions com os status usados no frontend
-- e na Edge Function update-company-status.
-- ============================================================

ALTER TABLE company_subscriptions
  DROP CONSTRAINT IF EXISTS company_subscriptions_status_check;

ALTER TABLE company_subscriptions
  ADD CONSTRAINT company_subscriptions_status_check
  CHECK (status IN ('trialing','active','past_due','suspended','cancelled','expired'));

COMMENT ON CONSTRAINT company_subscriptions_status_check ON company_subscriptions IS
  'Status comercial da assinatura. Mantém past_due para cobrança e expired para bloqueio de trial/acesso.';
