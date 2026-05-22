# OPERACIONAL5 — Configuração Final do Supabase

Esta etapa fica para o final.

## Passos

1. Criar projeto Supabase.
2. Aplicar supabase/migrations/001_schema_rls.sql.
3. Aplicar supabase/seed/demo.sql.
4. Criar bucket privado evidence.
5. Publicar Edge Functions.
6. Configurar variáveis no .env.

## Variáveis

VITE_DEMO_MODE=false
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key

## Storage

Bucket privado: evidence

Estrutura recomendada:
evidence/{company_id}/{post_id}/{yyyy-mm}/{type}/{file_id}.jpg
