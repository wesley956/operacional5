# OPERACIONAL5 — Auditoria Inicial Supabase/RLS

## Resultado

Auditoria inicial realizada sobre:

supabase/migrations/001_schema_rls.sql

## Resumo

- Tabelas criadas: 17
- Tabelas com RLS ativo: 17
- Tabelas sem RLS: 0
- Tabelas sem policy detectada: 0
- Policies detectadas para tabelas operacionais: sim
- Bucket evidence detectado: sim
- Policies para storage.objects/evidence detectadas: sim
- Uso de service_role na migration: 0 ocorrência

## Funções auxiliares detectadas

- current_company_id
- current_profile
- has_role
- has_any_role
- can_access_post
- haversine_distance
- write_audit

## Veredito

A migration está aprovada como base inicial de segurança.

Ainda assim, antes de produção real, precisa haver revisão manual no Supabase aplicado, conferindo:

- se RLS está realmente ativo no banco;
- se todas as policies foram aplicadas;
- se o bucket evidence está privado;
- se URLs públicas não estão habilitadas;
- se usuários operador/líder/supervisor/gerente/diretor/admin enxergam apenas o que deveriam;
- se cliente externo não acessa dados internos;
- se Edge Functions não expõem service_role ao frontend.

## Comando de auditoria local

node scripts/audit-supabase-sql.cjs
